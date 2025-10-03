import OpenAI from 'openai';
import { supabase } from '../lib/supabase';
import { HarvestLogService } from './harvestLogService';
import type { Database } from '../lib/database.types';

type HarvestResult = Database['public']['Tables']['harvest_results']['Row'];

interface AnalysisResult {
  summary: string;
  keywords: string[];
  entities: {
    persons: string[];
    locations: string[];
    organizations: string[];
    dates: string[];
  };
  category: string;
  subcategory?: string;
  language: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  topics: string[];
}

interface EmbeddingResult {
  embedding: number[];
  contentHash: string;
}

interface SimilarDocument {
  id: string;
  similarity: number;
  documentName: string;
  url: string;
}

export class ContentAnalysisService {
  private static openai: OpenAI | null = null;

  // Initialiser le client OpenAI
  private static getClient(): OpenAI {
    if (!this.openai) {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('VITE_OPENAI_API_KEY non configurée');
      }
      
      this.openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true
      });
    }
    return this.openai;
  }

  // Analyser le contenu d'un document
  static async analyzeContent(
    extractedText: string,
    documentName: string,
    documentUrl: string
  ): Promise<AnalysisResult> {
    console.log('🧠 Analyse de contenu pour:', documentName);
    
    const client = this.getClient();
    
    // Prompt optimisé pour l'analyse de documents
    const systemPrompt = `Tu es un expert en analyse de documents. Analyse le texte fourni et retourne un JSON avec cette structure exacte :

{
  "summary": "Résumé concis en 2-3 phrases",
  "keywords": ["mot-clé1", "mot-clé2", "mot-clé3"],
  "entities": {
    "persons": ["Nom Prénom"],
    "locations": ["Ville", "Pays"],
    "organizations": ["Organisation"],
    "dates": ["2024-01-15"]
  },
  "category": "Catégorie principale",
  "subcategory": "Sous-catégorie optionnelle",
  "language": "fr/en/ar",
  "sentiment": "positive/negative/neutral",
  "confidence": 0.95,
  "topics": ["sujet1", "sujet2"]
}

Catégories possibles : Juridique, Technique, Administratif, Financier, RH, Communication, Recherche, Autre.
Sois précis et factuel.`;

    try {
      const response = await client.chat.completions.create({
        model: import.meta.env.VITE_OPENAI_MODEL_NAME || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Document: ${documentName}\nURL: ${documentUrl}\n\nTexte à analyser:\n${extractedText.substring(0, 8000)}` }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Réponse OpenAI vide');
      }

      // Parser le JSON de réponse
      const analysis = JSON.parse(content);
      
      // Validation et nettoyage
      return {
        summary: analysis.summary || 'Résumé non disponible',
        keywords: Array.isArray(analysis.keywords) ? analysis.keywords : [],
        entities: {
          persons: Array.isArray(analysis.entities?.persons) ? analysis.entities.persons : [],
          locations: Array.isArray(analysis.entities?.locations) ? analysis.entities.locations : [],
          organizations: Array.isArray(analysis.entities?.organizations) ? analysis.entities.organizations : [],
          dates: Array.isArray(analysis.entities?.dates) ? analysis.entities.dates : []
        },
        category: analysis.category || 'Autre',
        subcategory: analysis.subcategory || undefined,
        language: analysis.language || 'unknown',
        sentiment: ['positive', 'negative', 'neutral'].includes(analysis.sentiment) ? analysis.sentiment : 'neutral',
        confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.5,
        topics: Array.isArray(analysis.topics) ? analysis.topics : []
      };

    } catch (error) {
      console.error('❌ Erreur analyse OpenAI:', error);
      throw new Error(`Erreur analyse: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // Générer des embeddings pour la recherche sémantique
  static async generateEmbedding(text: string): Promise<EmbeddingResult> {
    console.log('🔍 Génération embedding pour texte de', text.length, 'caractères...');
    
    const client = this.getClient();
    
    try {
      // Limiter le texte pour l'API OpenAI (max 8191 tokens ≈ 8000 caractères)
      const truncatedText = text.substring(0, 8000);
      
      const response = await client.embeddings.create({
        model: 'text-embedding-ada-002',
        input: truncatedText
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error('Embedding non généré');
      }

      console.log('✅ Embedding généré:', {
        dimensions: embedding.length,
        inputLength: truncatedText.length,
        usage: response.usage
      });

      // Générer un hash du contenu pour éviter les doublons
      const contentHash = await this.generateContentHash(truncatedText);

      return {
        embedding,
        contentHash
      };

    } catch (error) {
      console.error('❌ Erreur génération embedding:', error);
      throw new Error(`Erreur embedding: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // Rechercher des documents similaires (version simplifiée sans vecteurs)
  static async findSimilarDocuments(
    queryText: string,
    threshold: number = 0.8,
    maxResults: number = 10
  ): Promise<SimilarDocument[]> {
    console.log('🔍 Recherche de documents similaires...');
    
    try {
      if (!supabase) {
        throw new Error('Supabase non configuré');
      }

      // Utiliser la fonction SQL simplifiée
      const { data, error } = await supabase.rpc('search_similar_documents', {
        query_text: queryText,
        similarity_threshold: threshold,
        max_results: maxResults
      });

      if (error) {
        throw new Error(`Erreur recherche: ${error.message}`);
      }

      return (data || []).map((row: any) => ({
        id: row.harvest_result_id,
        similarity: row.similarity_score,
        documentName: row.document_name || 'Document sans nom',
        url: row.url_doc || ''
      }));

    } catch (error) {
      console.error('❌ Erreur recherche similaire:', error);
      throw new Error(`Erreur recherche: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // Classifier automatiquement les documents
  static async classifyDocuments(harvestResults: HarvestResult[]): Promise<void> {
    console.log('📊 Classification automatique de', harvestResults.length, 'documents');
    
    for (const result of harvestResults) {
      try {
        const contentAnalysis = result.content_analysis as any;
        if (!contentAnalysis?.extracted_text) {
          console.log('⚠️ Pas de texte extrait pour:', result.id);
          continue;
        }

        // Analyser le contenu
        const analysis = await this.analyzeContent(
          contentAnalysis.extracted_text,
          contentAnalysis.document_name || 'Document',
          contentAnalysis.url_doc || ''
        );

        // Sauvegarder la classification
        await supabase!.from('document_classifications').upsert({
          harvest_result_id: result.id,
          category: analysis.category,
          subcategory: analysis.subcategory,
          confidence_score: analysis.confidence,
          tags: [...analysis.keywords, ...analysis.topics]
        });

        console.log('✅ Document classifié:', analysis.category);

      } catch (error) {
        console.error('❌ Erreur classification document:', result.id, error);
        await HarvestLogService.logError(
          `Erreur classification document: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          result.data_source_id,
          { harvest_result_id: result.id }
        );
      }
    }
  }

  // Détecter les doublons par contenu
  static async detectDuplicates(threshold: number = 0.95): Promise<Array<{
    original: string;
    duplicates: string[];
    similarity: number;
  }>> {
    console.log('🔍 Détection de doublons...');
    
    try {
      if (!supabase) {
        throw new Error('Supabase non configuré');
      }

      const { data: embeddings, error } = await supabase
        .from('document_embeddings')
        .select(`
          harvest_result_id,
          embedding_data,
          harvest_results!inner(
            data
          )
        `);

      if (error) throw error;

      const duplicates: Array<{
        original: string;
        duplicates: string[];
        similarity: number;
      }> = [];

      // Comparer chaque document avec tous les autres
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const similarity = this.cosineSimilarity(
            embeddings[i].embedding_data as number[],
            embeddings[j].embedding_data as number[]
          );

          if (similarity >= threshold) {
            duplicates.push({
              original: embeddings[i].harvest_result_id,
              duplicates: [embeddings[j].harvest_result_id],
              similarity
            });
          }
        }
      }

      return duplicates;

    } catch (error) {
      console.error('❌ Erreur détection doublons:', error);
      throw new Error(`Erreur détection doublons: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // Créer une alerte de contenu
  static async createContentAlert(
    dataSourceId: string,
    name: string,
    keywords: string[],
    categories: string[] = []
  ): Promise<void> {
    console.log('🚨 Création alerte contenu:', name);
    
    try {
      if (!supabase) {
        throw new Error('Supabase non configuré');
      }

      const { error } = await supabase.from('content_alerts').insert({
        data_source_id: dataSourceId,
        name,
        keywords,
        categories,
        is_active: true
      });

      if (error) throw error;
      
      console.log('✅ Alerte créée avec succès');

    } catch (error) {
      console.error('❌ Erreur création alerte:', error);
      throw new Error(`Erreur création alerte: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // Vérifier les alertes pour un nouveau document
  static async checkContentAlerts(
    dataSourceId: string,
    analysis: AnalysisResult
  ): Promise<string[]> {
    console.log('🔔 Vérification alertes pour:', dataSourceId);
    
    try {
      if (!supabase) {
        throw new Error('Supabase non configuré');
      }

      const { data: alerts, error } = await supabase
        .from('content_alerts')
        .select('*')
        .eq('data_source_id', dataSourceId)
        .eq('is_active', true);

      if (error) throw error;

      const triggeredAlerts: string[] = [];

      for (const alert of alerts || []) {
        let triggered = false;

        // Vérifier les mots-clés
        if (alert.keywords && alert.keywords.length > 0) {
          const hasKeyword = alert.keywords.some((keyword: string) =>
            analysis.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase())) ||
            analysis.summary.toLowerCase().includes(keyword.toLowerCase())
          );
          if (hasKeyword) triggered = true;
        }

        // Vérifier les catégories
        if (alert.categories && alert.categories.length > 0) {
          const hasCategory = alert.categories.includes(analysis.category);
          if (hasCategory) triggered = true;
        }

        if (triggered) {
          triggeredAlerts.push(alert.name);
        }
      }

      return triggeredAlerts;

    } catch (error) {
      console.error('❌ Erreur vérification alertes:', error);
      return [];
    }
  }

  // Utilitaires
  private static async generateContentHash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private static cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}