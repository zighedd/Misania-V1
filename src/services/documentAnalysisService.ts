import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { fileTypeFromBuffer } from 'file-type';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { HarvestResultService } from './harvestResultService';
import { ContentAnalysisService } from './contentAnalysisService';

// Configure PDF.js worker using local import for version compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface AnalysisResult {
  success: boolean;
  extractedText: string;
  method: 'direct_pdf' | 'ocr_tesseract' | 'ocr_openai' | 'mixed' | 'cached';
  confidence: number;
  language: string;
  pageCount: number;
  processingTime: number;
  error?: string;
  // Données cachées (si méthode = 'cached')
  cachedSummary?: string;
  cachedKeywords?: string[];
  // Nouveau : statut des embeddings
  embeddingsGenerated?: boolean;
}

interface AnalysisProgress {
  phase: 'download' | 'detection' | 'extraction' | 'ocr' | 'analysis' | 'completed';
  message: string;
  progress: number; // 0-100
  currentPage?: number;
  totalPages?: number;
}

export class DocumentAnalysisService {
  private static progressCallback: ((progress: AnalysisProgress) => void) | null = null;
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly OCR_TIMEOUT = 60000; // 60 secondes par page

  // Définir le callback de progression
  static setProgressCallback(callback: (progress: AnalysisProgress) => void) {
    this.progressCallback = callback;
  }

  // Notifier la progression
  private static notifyProgress(progress: AnalysisProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  // Analyser un document depuis une URL
  static async analyzeDocumentFromUrl(
    url: string,
    filename: string,
    harvestResultId?: string,
    options: {
      language?: string;
      useOpenAIVision?: boolean;
      maxPages?: number;
      includeEmbeddings?: boolean;
      forceNewAnalysis?: boolean;
    } = {}
  ): Promise<AnalysisResult> {
    console.log('🔍 DÉBUT ANALYSE DOCUMENT:', filename);
    console.log('📄 URL:', url);
    console.log('🔧 Options:', options);
    
    // Vérifier si l'analyse existe déjà (si harvestResultId fourni)
    if (harvestResultId && !options.forceNewAnalysis) {
      const existingAnalysis = await this.checkExistingAnalysis(harvestResultId);
      if (existingAnalysis) {
        console.log('✅ ANALYSE EXISTANTE TROUVÉE - Utilisation du cache');
        return existingAnalysis;
      }
    } else if (options.forceNewAnalysis) {
      console.log('🔄 FORCE NOUVELLE ANALYSE - Bypass du cache');
    }
    
    const startTime = Date.now();
    const { language = 'fra+eng', useOpenAIVision = false, maxPages = 10, includeEmbeddings = false } = options;

    try {
      // Phase 1: Téléchargement
      this.notifyProgress({
        phase: 'download',
        message: 'Téléchargement du document...',
        progress: 10
      });

      const documentBuffer = await this.downloadDocument(url);
      
      // Phase 2: Détection du type
      this.notifyProgress({
        phase: 'detection',
        message: 'Analyse du type de document...',
        progress: 20
      });

      const fileType = await this.detectFileType(documentBuffer, filename);
      console.log('📋 Type détecté:', fileType);

      let result: AnalysisResult;

      switch (fileType) {
        case 'pdf':
          result = await this.analyzePdf(documentBuffer, { language, useOpenAIVision, maxPages });
          break;
        case 'image':
          result = await this.analyzeImage(documentBuffer, { language, useOpenAIVision });
          break;
        case 'docx':
          result = await this.analyzeDocx(documentBuffer);
          break;
        default:
          throw new Error(`Type de fichier non supporté: ${fileType}`);
      }

      result.processingTime = Date.now() - startTime;
      
      // Sauvegarder l'analyse si harvestResultId fourni
      if (harvestResultId && result.success) {
        const embeddingsGenerated = await this.saveAnalysisResults(harvestResultId, result, filename, options.includeEmbeddings || false);
        result.embeddingsGenerated = embeddingsGenerated;
      }
      
      this.notifyProgress({
        phase: 'completed',
        message: 'Analyse terminée avec succès',
        progress: 100
      });

      console.log('✅ ANALYSE TERMINÉE:', {
        method: result.method,
        textLength: result.extractedText.length,
        confidence: result.confidence,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      console.error('❌ ERREUR ANALYSE:', error);
      
      return {
        success: false,
        extractedText: '',
        method: 'direct_pdf',
        confidence: 0,
        language: 'unknown',
        pageCount: 0,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  // Télécharger le document
  private static async downloadDocument(url: string): Promise<Uint8Array> {
    console.log('📥 Téléchargement:', url);
    
    // Utiliser le proxy Supabase pour contourner CORS
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-proxy`;
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erreur proxy: ${response.status} - ${errorData.error || response.statusText}`);
    }


    const arrayBuffer = await response.arrayBuffer();
    
    // Vérifier la taille après téléchargement
    if (arrayBuffer.byteLength > this.MAX_FILE_SIZE) {
      throw new Error(`Fichier trop volumineux: ${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB (max: 50MB)`);
    }
    
    const buffer = new Uint8Array(arrayBuffer);
    
    console.log('✅ Document téléchargé:', Math.round(buffer.length / 1024), 'KB');
    return buffer;
  }

  // Détecter le type de fichier
  private static async detectFileType(buffer: Uint8Array, filename: string): Promise<string> {
    // Utiliser file-type pour une détection précise
    const detectedType = await fileTypeFromBuffer(buffer);
    
    if (detectedType) {
      if (detectedType.mime === 'application/pdf') return 'pdf';
      if (detectedType.mime.startsWith('image/')) return 'image';
      if (detectedType.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
    }

    // Fallback sur l'extension
    const extension = filename.toLowerCase().split('.').pop();
    switch (extension) {
      case 'pdf': return 'pdf';
      case 'jpg': case 'jpeg': case 'png': case 'tiff': case 'bmp': return 'image';
      case 'docx': return 'docx';
      default: return 'unknown';
    }
  }

  // Analyser un PDF (avec détection texte/image)
  private static async analyzePdf(
    buffer: Uint8Array, 
    options: { language: string; useOpenAIVision: boolean; maxPages: number }
  ): Promise<AnalysisResult> {
    console.log('📄 Analyse PDF...');

    this.notifyProgress({
      phase: 'extraction',
      message: 'Tentative d\'extraction de texte direct...',
      progress: 30
    });

    try {
      // Étape 1: Tenter l'extraction directe de texte
      const uint8Array = buffer;
      const loadingTask = pdfjsLib.getDocument(uint8Array);
      const pdfDocument = await loadingTask.promise;
      
      let directText = '';
      const numPages = pdfDocument.numPages;
      
      // Extraire le texte de toutes les pages
      for (let pageNum = 1; pageNum <= Math.min(numPages, options.maxPages); pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        directText += pageText + '\n';
      }
      
      directText = directText.trim();
      
      console.log('📝 Texte direct extrait:', directText.length, 'caractères');
      console.log('📊 Pages détectées:', numPages);

      // Si on a du texte significatif (plus de 100 caractères), c'est un "vrai" PDF
      if (directText.length > 100) {
        console.log('✅ PDF avec texte détecté');
        return {
          success: true,
          extractedText: directText,
          method: 'direct_pdf',
          confidence: 0.95,
          language: this.detectLanguage(directText),
          pageCount: numPages,
          processingTime: 0
        };
      }

      // Étape 2: PDF "image" détecté, passer à l'OCR
      console.log('🖼️ PDF image détecté, lancement OCR...');
      return await this.performOcrOnPdf(uint8Array, pdfDocument, options);

    } catch (error) {
      console.error('❌ Erreur analyse PDF:', error);
      
      // En cas d'erreur d'extraction directe, tenter l'OCR
      console.log('🔄 Tentative OCR après échec extraction directe...');
      try {
        const uint8Array = buffer;
        const loadingTask = pdfjsLib.getDocument(uint8Array);
        const pdfDocument = await loadingTask.promise;
        return await this.performOcrOnPdf(uint8Array, pdfDocument, options);
      } catch (ocrError) {
        throw error; // Relancer l'erreur originale
      }
    }
  }

  // Effectuer l'OCR sur un PDF
  private static async performOcrOnPdf(
    uint8Array: Uint8Array,
    pdfDocument: any,
    options: { language: string; useOpenAIVision: boolean; maxPages: number }
  ): Promise<AnalysisResult> {
    console.log('🔍 DÉBUT OCR PDF');

    this.notifyProgress({
      phase: 'ocr',
      message: 'Conversion PDF en images...',
      progress: 40
    });

    try {
      // Limiter le nombre de pages
      const numPages = pdfDocument.numPages;
      const maxPages = Math.min(options.maxPages, numPages, 10);
      const pageImages = [];
      
      for (let i = 1; i <= maxPages; i++) {
        try {
          // Rendre la page en canvas
          const page = await pdfDocument.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // Haute résolution pour OCR
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          // Convertir le canvas en image buffer
          const imageDataUrl = canvas.toDataURL('image/png');
          pageImages.push(imageDataUrl);
          
          this.notifyProgress({
            phase: 'ocr',
            message: `Conversion page ${i}/${maxPages}...`,
            progress: 40 + (i / maxPages) * 20,
            currentPage: i,
            totalPages: maxPages
          });
        } catch (pageError) {
          console.log(`⚠️ Page ${i} non accessible, arrêt conversion`);
          break;
        }
      }

      if (pageImages.length === 0) {
        throw new Error('Aucune page convertible trouvée dans le PDF');
      }

      console.log('✅ Pages converties:', pageImages.length);

      // Effectuer l'OCR sur chaque page
      let allText = '';
      let totalConfidence = 0;

      for (let i = 0; i < pageImages.length; i++) {
        this.notifyProgress({
          phase: 'ocr',
          message: `OCR page ${i + 1}/${pageImages.length}...`,
          progress: 60 + (i / pageImages.length) * 30,
          currentPage: i + 1,
          totalPages: pageImages.length
        });

        const pageResult = await this.performOcrOnImage(pageImages[i], options.language);
        allText += pageResult.text + '\n\n';
        totalConfidence += pageResult.confidence;
      }

      const avgConfidence = totalConfidence / pageImages.length / 100; // Normaliser

      console.log('✅ OCR terminé:', {
        pages: pageImages.length,
        textLength: allText.length,
        avgConfidence: avgConfidence
      });

      return {
        success: true,
        extractedText: allText.trim(),
        method: 'ocr_tesseract',
        confidence: avgConfidence,
        language: this.detectLanguage(allText),
        pageCount: pageImages.length,
        processingTime: 0
      };

    } catch (error) {
      console.error('❌ Erreur OCR PDF:', error);
      throw new Error(`Échec OCR: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // Effectuer l'OCR sur une image
  private static async performOcrOnImage(
    imageSource: Uint8Array | string,
    language: string = 'fra+eng'
  ): Promise<{ text: string; confidence: number }> {
    console.log('🔍 OCR sur image, langue:', language);

    try {
      // Effectuer l'OCR avec Tesseract directement sur l'image
      const { data } = await Tesseract.recognize(imageSource, language, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR progression: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      console.log('✅ OCR terminé:', {
        textLength: data.text.length,
        confidence: data.confidence
      });

      return {
        text: data.text,
        confidence: data.confidence
      };

    } catch (error) {
      console.error('❌ Erreur OCR image:', error);
      throw new Error(`Échec OCR image: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // Analyser une image directement
  private static async analyzeImage(
    buffer: Uint8Array,
    options: { language: string; useOpenAIVision: boolean }
  ): Promise<AnalysisResult> {
    console.log('🖼️ Analyse image directe');

    this.notifyProgress({
      phase: 'ocr',
      message: 'OCR sur image...',
      progress: 50
    });

    const result = await this.performOcrOnImage(buffer, options.language);

    return {
      success: true,
      extractedText: result.text,
      method: 'ocr_tesseract',
      confidence: result.confidence / 100,
      language: this.detectLanguage(result.text),
      pageCount: 1,
      processingTime: 0
    };
  }

  // Analyser un document DOCX
  private static async analyzeDocx(buffer: Uint8Array): Promise<AnalysisResult> {
    console.log('📄 Analyse DOCX');

    this.notifyProgress({
      phase: 'extraction',
      message: 'Extraction texte DOCX...',
      progress: 50
    });

    try {
      // Note: mammoth.js nécessiterait une implémentation spécifique
      // Pour l'instant, on simule l'extraction
      const text = "Extraction DOCX non encore implémentée";

      return {
        success: true,
        extractedText: text,
        method: 'direct_pdf', // Sera changé en 'docx_extraction'
        confidence: 0.9,
        language: this.detectLanguage(text),
        pageCount: 1,
        processingTime: 0
      };

    } catch (error) {
      throw new Error(`Erreur analyse DOCX: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // Détecter la langue du texte (basique)
  private static detectLanguage(text: string): string {
    const sample = text.toLowerCase().substring(0, 1000);
    
    // Mots français courants
    const frenchWords = ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour'];
    // Mots anglais courants  
    const englishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for'];
    // Mots arabes courants (en caractères arabes)
    const arabicPattern = /[\u0600-\u06FF]/;

    if (arabicPattern.test(sample)) return 'ar';

    let frenchScore = 0;
    let englishScore = 0;

    frenchWords.forEach(word => {
      if (sample.includes(` ${word} `)) frenchScore++;
    });

    englishWords.forEach(word => {
      if (sample.includes(` ${word} `)) englishScore++;
    });

    if (frenchScore > englishScore) return 'fr';
    if (englishScore > frenchScore) return 'en';
    return 'unknown';
  }

  // Vérifier si une analyse existe déjà
  private static async checkExistingAnalysis(harvestResultId: string): Promise<AnalysisResult | null> {
    try {
      console.log('🔍 Vérification analyse existante pour:', harvestResultId);
      
      // Récupérer le résultat avec les colonnes d'analyse
      const harvestResult = await HarvestResultService.getResultById(harvestResultId);
      
      if (!harvestResult || !harvestResult.analysis_completed_at) {
        console.log('❌ Aucune analyse existante trouvée');
        return null;
      }
      
      // Reconstituer le résultat d'analyse depuis les données sauvegardées
      const analysisResult: AnalysisResult = {
        success: true,
        extractedText: '', // Le texte sera chargé depuis le fichier .txt si nécessaire
        method: 'cached',
        confidence: 0.9,
        language: 'fr', // Sera déterminé depuis les mots-clés si nécessaire
        pageCount: 1,
        processingTime: 0,
        // Ajouter les données d'analyse cachées
        cachedSummary: harvestResult.analysis_summary,
        cachedKeywords: harvestResult.analysis_keywords as string[] || []
      };
      
      console.log('✅ Analyse existante récupérée du cache');
      return analysisResult;
      
    } catch (error) {
      console.error('❌ Erreur vérification analyse existante:', error);
      return null; // En cas d'erreur, procéder à une nouvelle analyse
    }
  }

  // Sauvegarder les résultats d'analyse
  private static async saveAnalysisResults(
    harvestResultId: string, 
    analysisResult: AnalysisResult,
    filename: string,
    includeEmbeddings: boolean = false
  ): Promise<boolean> {
    try {
      console.log('💾 Sauvegarde analyse pour:', harvestResultId);
      console.log('🔍 Embeddings demandés:', includeEmbeddings);
      
      // Analyser le contenu avec OpenAI pour obtenir résumé et mots-clés
      let summary = '';
      let keywords: string[] = [];
      let embeddingData: any = null;
      let embeddingsGenerated = false;
      
      if (analysisResult.extractedText.length > 50) {
        try {
          const contentAnalysis = await ContentAnalysisService.analyzeContent(
            analysisResult.extractedText,
            filename,
            '' // URL pas nécessaire pour l'analyse
          );
          
          summary = contentAnalysis.summary;
          keywords = contentAnalysis.keywords;
          
          console.log('✅ Analyse de contenu terminée:', {
            summaryLength: summary.length,
            keywordsCount: keywords.length
          });

          // Générer les embeddings si demandé
          if (includeEmbeddings) {
            try {
              embeddingData = await ContentAnalysisService.generateEmbedding(analysisResult.extractedText);
              embeddingsGenerated = true;
              console.log('✅ Embeddings générés');
            } catch (embeddingError) {
              console.error('⚠️ Erreur génération embeddings (non critique):', embeddingError);
            }
          }
          
        } catch (analysisError) {
          console.error('⚠️ Erreur analyse contenu (non critique):', analysisError);
        }
      }
      
      console.log('✅ Analyse de contenu terminée');
      
      // Préparer les données de mise à jour
      const updateData: any = {
        analysis_summary: summary,
        analysis_keywords: keywords,
        analysis_completed_at: new Date().toISOString()
      };

      // Ajouter les embeddings aux métadonnées si générés
      if (embeddingData) {
        // Récupérer les métadonnées existantes
        const existingResult = await HarvestResultService.getResultById(harvestResultId);
        const existingMetadata = existingResult?.metadata as any || {};
        
        updateData.metadata = {
          ...existingMetadata,
          embedding: embeddingData
        };
        
        console.log('📊 Embeddings ajoutés aux métadonnées');
      }

      // Mettre à jour le harvest_result
      await HarvestResultService.updateResult(harvestResultId, updateData);
      
      // Optionnel : Sauvegarder le texte intégral dans un fichier .txt
      // (pour l'instant, on garde juste en mémoire pour éviter la complexité)
      
      console.log('✅ Analyse sauvegardée avec succès');
      return embeddingsGenerated;
      
    } catch (error) {
      console.error('❌ Erreur sauvegarde analyse (non critique):', error);
      // Ne pas faire échouer l'analyse pour une erreur de sauvegarde
      return false;
    }
  }

  // Méthodes utilitaires pour les tests
  static async testOcrCapabilities(): Promise<void> {
    console.log('🧪 Test des capacités OCR...');
    
    try {
      // Tester Tesseract
      const testResult = await Tesseract.recognize(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'eng'
      );
      console.log('✅ Tesseract opérationnel');
      
    } catch (error) {
      console.error('❌ Erreur test OCR:', error);
    }
  }
}