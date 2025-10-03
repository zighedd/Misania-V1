interface ParsedDocument {
  url_doc: string;
  document_name: string;
  filename: string;
  date_edition: string;
  auteurs: string;
  langue: string;
  resume: string;
  statut: string;
  issue_number: string;
  annee: number;
  format: string;
  type_document: string;
  contient_texte: string;
  pattern_verified: boolean;
  notes: string;
  obstacles: string;
  source_page?: string;
}

interface ParsedHarvestData {
  documents: ParsedDocument[];
  obstacles_globaux: string[];
  recommandations: string | null;
  logs: Array<{
    level: string;
    message: string;
    details?: any;
  }>;
}

interface ParseResult {
  success: boolean;
  data?: ParsedHarvestData;
  error?: string;
  warnings: string[];
}

export class HarvestDataParser {
  
  // Parser le JSON de réponse OpenAI
  static parseOpenAIResponse(harvestResultData: any): ParseResult {
    console.log('🔍 HarvestDataParser.parseOpenAIResponse appelé');
    console.log('📊 Structure des données reçues:', {
      hasDocuments: Array.isArray(harvestResultData?.documents),
      hasObstacles: Array.isArray(harvestResultData?.['obstacles-globaux']),
      hasRecommandations: typeof harvestResultData?.recommandations === 'string'
    });
    
    const warnings: string[] = [];
    
    try {
      // Vérifier que nous avons bien la structure attendue
      if (!harvestResultData || typeof harvestResultData !== 'object') {
        return {
          success: false,
          error: 'Données de moissonnage invalides ou manquantes',
          warnings
        };
      }
      
      // Parser directement les données structurées
      const parsedData = this.parseStructuredData(harvestResultData);
      
      if (!parsedData.success) {
        return parsedData;
      }
      
      console.log('📊 Données parsées:', {
        documents: parsedData.data?.documents.length || 0,
        obstacles: parsedData.data?.obstacles_globaux.length || 0,
        hasRecommandations: !!parsedData.data?.recommandations
      });
      
      return {
        success: true,
        data: parsedData.data,
        warnings
      };
      
    } catch (error) {
      console.error('❌ Erreur lors du parsing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de parsing inconnue',
        warnings
      };
    }
  }
  
  // Parser les données déjà structurées
  private static parseStructuredData(structuredData: any): ParseResult {
    console.log('🔍 Parsing des données structurées...');
    
    const warnings: string[] = [];
    const parsedData: ParsedHarvestData = {
      documents: [],
      obstacles_globaux: [],
      recommandations: null,
      logs: []
    };
    
    try {
      // Parser les documents
      if (structuredData.documents && Array.isArray(structuredData.documents)) {
        console.log('📄 Parsing de', structuredData.documents.length, 'documents');
        
        structuredData.documents.forEach((doc: any, index: number) => {
          try {
            const parsedDoc = this.parseDocument(doc, index);
            if (parsedDoc) { // null si url_doc manquante
              parsedData.documents.push(parsedDoc);
            } else {
              console.warn(`Document ${index + 1} ignoré: url_doc manquante`);
            }
          } catch (docError) {
            warnings.push(`Document ${index + 1}: ${docError instanceof Error ? docError.message : 'Erreur de parsing'}`);
          }
        });
        
        console.log(`✅ Documents valides retenus: ${parsedData.documents.length}/${structuredData.documents.length}`);
      } else {
        warnings.push('Aucun tableau "documents" trouvé dans les données');
      }
      
      // Parser les obstacles globaux
      if (structuredData['obstacles-globaux'] && Array.isArray(structuredData['obstacles-globaux'])) {
        parsedData.obstacles_globaux = structuredData['obstacles-globaux']
          .filter((obstacle: any) => typeof obstacle === 'string')
          .map((obstacle: string) => obstacle.trim())
          .filter((obstacle: string) => obstacle.length > 0);
        
        console.log('🚧 Obstacles globaux parsés:', parsedData.obstacles_globaux.length);
      }
      
      // Parser les recommandations
      if (structuredData.recommandations && typeof structuredData.recommandations === 'string') {
        parsedData.recommandations = structuredData.recommandations.trim();
        console.log('💡 Recommandations parsées');
      }
      
      // Parser les logs si présents (optionnel)
      if (structuredData.logs && Array.isArray(structuredData.logs)) {
        structuredData.logs.forEach((log: any) => {
          if (log.message) {
            parsedData.logs.push({
              level: log.level || 'info',
              message: log.message,
              details: log.details || {}
            });
          }
        });
        console.log('📝 Logs parsés:', parsedData.logs.length);
      }
      
      return {
        success: true,
        data: parsedData,
        warnings
      };
      
    } catch (error) {
      console.error('❌ Erreur lors du parsing des données structurées:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de parsing des données structurées',
        warnings
      };
    }
  }
  
  // Parser un document individuel
  private static parseDocument(doc: any, index: number): ParsedDocument | null {
    if (!doc || typeof doc !== 'object') {
      throw new Error('Document invalide');
    }
    
    // URL obligatoire - EXCLUSION STRICTE si manquante
    if (!doc.url_doc || typeof doc.url_doc !== 'string') {
      console.warn(`Document ${index + 1} exclu: url_doc manquante ou invalide`);
      return null; // Document complètement ignoré
    }
    
    if (doc.url_doc.trim() === '') {
      console.warn(`Document ${index + 1} exclu: url_doc vide`);
      return null; // Document complètement ignoré
    }
    
    // Construire le document parsé - TOUS les champs optionnels sauf url_doc
    const parsedDoc: ParsedDocument = {
      url_doc: doc.url_doc.trim(),
      // Tous les autres champs optionnels - préserver les valeurs exactes d'OpenAI
      document_name: doc.document_name || '',
      filename: doc.filename || '',
      date_edition: doc.date_edition || '',
      auteurs: doc.auteurs || '',
      langue: doc.langue || '',
      resume: doc.resume || '',
      statut: doc.statut || '',
      issue_number: doc.issue_number || null,
      annee: this.parseYear(doc.annee) || 0,
      format: doc.format || '',
      type_document: doc.type_document || '',
      contient_texte: doc.contient_texte || '',
      pattern_verified: Boolean(doc.pattern_verified),
      notes: doc.notes || '',
      obstacles: doc.obstacles || null,
      source_page: doc.source_page || ''
    };
    
    return parsedDoc;
  }
  
  // Utilitaires
  private static extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || '';
      return filename.includes('.') ? filename : `${filename}.pdf`;
    } catch {
      return 'document.pdf';
    }
  }
  
  private static extractFormatFromUrl(url: string): string {
    try {
      const extension = url.split('.').pop()?.toLowerCase();
      return extension || 'pdf';
    } catch {
      return 'pdf';
    }
  }
  
  private static parseYear(yearValue: any): number | null {
    if (typeof yearValue === 'number') {
      return yearValue >= 1900 && yearValue <= new Date().getFullYear() + 1 ? yearValue : null;
    }
    if (typeof yearValue === 'string') {
      const parsed = parseInt(yearValue, 10);
      return !isNaN(parsed) && parsed >= 1900 && parsed <= new Date().getFullYear() + 1 ? parsed : null;
    }
    return null;
  }
  
  // Méthode pour valider les données parsées
  static validateParsedData(data: ParsedHarvestData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Vérifier qu'il y a au moins un document
    if (!data.documents || data.documents.length === 0) {
      errors.push('Aucun document valide trouvé');
    }
    
    // Vérifier les URLs des documents
    data.documents.forEach((doc, index) => {
      try {
        new URL(doc.url_doc);
      } catch {
        errors.push(`Document ${index + 1}: URL invalide (${doc.url_doc})`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}