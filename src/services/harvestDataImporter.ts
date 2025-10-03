import { HarvestResultService } from './harvestResultService';
import { HarvestLogService } from './harvestLogService';
import { DataSourceService } from './dataSourceService';
import { HarvestDataParser } from './harvestDataParser';
import type { Database, OpenAIDocument } from '../lib/database.types';

type DataSource = Database['public']['Tables']['data_sources']['Row'];
type HarvestResult = Database['public']['Tables']['harvest_results']['Row'];

interface ImportProgress {
  phase: 'parsing' | 'documents' | 'site_update' | 'logs' | 'completed' | 'error';
  message: string;
  progress: number; // 0-100
  documentsProcessed: number;
  totalDocuments: number;
  errors: string[];
  warnings: string[];
}

interface ImportResult {
  success: boolean;
  documentsImported: number;
  obstaclesUpdated: boolean;
  recommandationsUpdated: boolean;
  logsImported: number;
  errors: string[];
  warnings: string[];
}

export class HarvestDataImporter {
  private static progressCallback: ((progress: ImportProgress) => void) | null = null;

  // Définir le callback de progression
  static setProgressCallback(callback: (progress: ImportProgress) => void) {
    this.progressCallback = callback;
  }

  // Notifier la progression
  private static notifyProgress(progress: ImportProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  // Importer les données d'un résultat de moissonnage
  static async importHarvestData(
    harvestResult: HarvestResult,
    dataSource: DataSource
  ): Promise<ImportResult> {
    console.log('🚀 DÉBUT IMPORT - HarvestDataImporter appelé');
    console.log('📊 HarvestResult ID:', harvestResult.id);
    console.log('📊 DataSource:', dataSource.name);
    
    const result: ImportResult = {
      success: false,
      documentsImported: 0,
      obstaclesUpdated: false,
      recommandationsUpdated: false,
      logsImported: 0,
      errors: [],
      warnings: []
    };

    try {
      // Phase 1: Parsing des données
      console.log('📝 Phase 1: Parsing des données...');
      this.notifyProgress({
        phase: 'parsing',
        message: 'Analyse des données de moissonnage...',
        progress: 10,
        documentsProcessed: 0,
        totalDocuments: 0,
        errors: [],
        warnings: []
      });

      const parseResult = HarvestDataParser.parseOpenAIResponse(harvestResult.data);
      
      if (!parseResult.success) {
        console.error('❌ Échec du parsing:', parseResult.error);
        result.errors.push(parseResult.error || 'Erreur de parsing');
        this.notifyProgress({
          phase: 'error',
          message: `Erreur parsing: ${parseResult.error}`,
          progress: 0,
          documentsProcessed: 0,
          totalDocuments: 0,
          errors: result.errors,
          warnings: parseResult.warnings
        });
        return result;
      }

      const parsedData = parseResult.data!;
      result.warnings = parseResult.warnings;
      
      console.log('✅ Parsing réussi:', {
        documents: parsedData.documents.length,
        obstacles: parsedData.obstacles_globaux.length,
        hasRecommandations: !!parsedData.recommandations
      });

      // Validation des données parsées
      const validation = HarvestDataParser.validateParsedData(parsedData);
      if (!validation.isValid) {
        console.error('❌ Validation échouée:', validation.errors);
        result.errors.push(...validation.errors);
        this.notifyProgress({
          phase: 'error',
          message: `Validation échouée: ${validation.errors[0]}`,
          progress: 0,
          documentsProcessed: 0,
          totalDocuments: parsedData.documents.length,
          errors: result.errors,
          warnings: result.warnings
        });
        return result;
      }

      // Phase 2: Import des documents
      console.log('📄 Phase 2: Import des documents...');
      this.notifyProgress({
        phase: 'documents',
        message: 'Import des documents...',
        progress: 30,
        documentsProcessed: 0,
        totalDocuments: parsedData.documents.length,
        errors: [],
        warnings: result.warnings
      });

      let documentsImported = 0;
      for (let i = 0; i < parsedData.documents.length; i++) {
        const doc = parsedData.documents[i];
        
        try {
          console.log(`📄 Import document ${i + 1}/${parsedData.documents.length}:`, doc.document_name || doc.filename || doc.url_doc);
          
          // Validation finale : s'assurer que url_doc existe
          if (!doc.url_doc || doc.url_doc.trim() === '') {
            console.warn(`Document ${i + 1} ignoré: url_doc manquante`);
            continue;
          }
          
          // Créer une entrée dans harvest_results pour ce document
          await HarvestResultService.createResult({
            data_source_id: dataSource.id,
            config_id: harvestResult.config_id,
            data: {
              document: doc, // Document avec les vrais noms de champs OpenAI
              source_harvest_id: harvestResult.id // Référence au moissonnage original
            },
            metadata: {
              import_timestamp: new Date().toISOString(),
              original_harvest_id: harvestResult.id,
              document_index: i,
              import_method: 'parsed_from_openai',
              document_url: doc.url_doc,
              document_name: doc.document_name || 'Sans nom'
            },
            status: 'success'
          });
          
          documentsImported++;
          
          // Mettre à jour la progression
          const progress = 30 + ((i + 1) / parsedData.documents.length) * 40; // 30% à 70%
          this.notifyProgress({
            phase: 'documents',
            message: `Import document: ${doc.document_name}`,
            progress,
            documentsProcessed: i + 1,
            totalDocuments: parsedData.documents.length,
            errors: [],
            warnings: result.warnings
          });
          
        } catch (docError) {
          console.error(`❌ Erreur import document ${i + 1}:`, docError);
          const docName = doc.document_name || doc.filename || doc.url_doc || 'Document inconnu';
          const errorMsg = `Document ${i + 1} (${docName}): ${docError instanceof Error ? docError.message : 'Erreur inconnue'}`;
          result.errors.push(errorMsg);
        }
      }
      
      result.documentsImported = documentsImported;
      console.log(`✅ Documents importés: ${documentsImported}/${parsedData.documents.length}`);

      // Phase 3: Mise à jour du site (obstacles et recommandations)
      console.log('🔄 Phase 3: Mise à jour du site...');
      this.notifyProgress({
        phase: 'site_update',
        message: 'Mise à jour des informations du site...',
        progress: 75,
        documentsProcessed: parsedData.documents.length,
        totalDocuments: parsedData.documents.length,
        errors: [],
        warnings: result.warnings
      });

      try {
        const updateData: any = {};
        
        // Mettre à jour les obstacles globaux
        if (parsedData.obstacles_globaux.length > 0) {
          updateData.obstacles_globaux = parsedData.obstacles_globaux;
          result.obstaclesUpdated = true;
          console.log('🚧 Obstacles globaux mis à jour:', parsedData.obstacles_globaux.length);
        }
        
        // Mettre à jour les recommandations
        if (parsedData.recommandations) {
          updateData.recommandations = parsedData.recommandations;
          result.recommandationsUpdated = true;
          console.log('💡 Recommandations mises à jour');
        }
        
        if (Object.keys(updateData).length > 0) {
          await DataSourceService.updateDataSource(dataSource.id, updateData);
          console.log('✅ Site mis à jour avec succès');
        }
        
      } catch (updateError) {
        console.error('❌ Erreur mise à jour site:', updateError);
        result.errors.push(`Erreur mise à jour site: ${updateError instanceof Error ? updateError.message : 'Erreur inconnue'}`);
      }

      // Phase 4: Import des logs
      console.log('📝 Phase 4: Import des logs...');
      this.notifyProgress({
        phase: 'logs',
        message: 'Import des logs...',
        progress: 90,
        documentsProcessed: parsedData.documents.length,
        totalDocuments: parsedData.documents.length,
        errors: [],
        warnings: result.warnings
      });

      let logsImported = 0;
      for (const log of parsedData.logs) {
        try {
          await HarvestLogService.createLog({
            data_source_id: dataSource.id,
            level: log.level,
            message: log.message,
            details: {
              ...log.details,
              import_source: 'openai_harvest',
              original_harvest_id: harvestResult.id,
              import_timestamp: new Date().toISOString()
            }
          });
          logsImported++;
        } catch (logError) {
          console.error('❌ Erreur import log:', logError);
          // Les erreurs de logs ne font pas échouer l'import global
        }
      }
      
      result.logsImported = logsImported;
      console.log(`✅ Logs importés: ${logsImported}/${parsedData.logs.length}`);

      // Log final de l'import
      try {
        await HarvestLogService.createLog({
          data_source_id: dataSource.id,
          level: 'info',
          message: `Import des données de moissonnage terminé: ${documentsImported} documents importés`,
          details: {
            original_harvest_id: harvestResult.id,
            documents_imported: documentsImported,
            obstacles_updated: result.obstaclesUpdated,
            recommandations_updated: result.recommandationsUpdated,
            logs_imported: logsImported,
            warnings_count: result.warnings.length,
            errors_count: result.errors.length
          }
        });
      } catch (error) {
        console.error('❌ Erreur log final (non critique):', error);
      }

      // Phase 5: Terminé
      console.log('🎉 IMPORT TERMINÉ AVEC SUCCÈS');
      this.notifyProgress({
        phase: 'completed',
        message: `Import terminé: ${documentsImported} documents importés`,
        progress: 100,
        documentsProcessed: parsedData.documents.length,
        totalDocuments: parsedData.documents.length,
        errors: result.errors,
        warnings: result.warnings
      });

      result.success = result.errors.length === 0 || documentsImported > 0; // Succès si au moins un document importé
      return result;

    } catch (error) {
      console.error('❌ ERREUR CRITIQUE IMPORT:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      result.errors.push(errorMessage);

      this.notifyProgress({
        phase: 'error',
        message: `Erreur lors de l'import: ${errorMessage}`,
        progress: 0,
        documentsProcessed: 0,
        totalDocuments: 0,
        errors: result.errors,
        warnings: result.warnings
      });

      return result;
    }
  }

  // Méthode utilitaire pour vérifier si des données ont déjà été importées
  static async checkIfAlreadyImported(harvestResultId: string): Promise<boolean> {
    try {
      // Chercher des résultats qui référencent ce harvest_result comme source
      const existingResults = await HarvestResultService.getAllResults(100);
      
      return existingResults.some(result => {
        const metadata = result.metadata as any;
        return metadata?.original_harvest_id === harvestResultId;
      });
    } catch (error) {
      console.error('Erreur vérification import existant:', error);
      return false;
    }
  }
}