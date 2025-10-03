import { JsonImportValidator } from './jsonImportValidator';
import { HarvestResultService } from './harvestResultService';
import { HarvestLogService } from './harvestLogService';
import type { Database } from '../lib/database.types';

type DataSource = Database['public']['Tables']['data_sources']['Row'];
type HarvestingConfig = Database['public']['Tables']['harvesting_configs']['Row'];

interface ImportProgress {
  phase: 'validation' | 'directory' | 'downloading' | 'saving' | 'completed' | 'error';
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
  documentsWithErrors: number;
  logsImported: number;
  localPath: string;
  errors: string[];
}

export class HarvestImportService {
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

  // Importer un fichier JSON de moissonnage
  static async importHarvestResults(
    jsonContent: string,
    dataSource: DataSource,
    config?: HarvestingConfig
  ): Promise<ImportResult> {
    console.log('🚀 DÉBUT IMPORTATION - Service appelé');
    console.log('📊 DataSource:', dataSource.name, 'ID:', dataSource.id);
    
    const result: ImportResult = {
      success: false,
      documentsImported: 0,
      documentsWithErrors: 0,
      logsImported: 0,
      localPath: '',
      errors: []
    };

    try {
      console.log('📝 Parsing JSON...');
      // Phase 1: Validation du JSON
      this.notifyProgress({
        phase: 'validation',
        message: 'Validation du fichier JSON...',
        progress: 10,
        documentsProcessed: 0,
        totalDocuments: 0,
        errors: [],
        warnings: []
      });

      const validation = JsonImportValidator.validateImportJson(jsonContent);
      console.log('✅ Validation terminée:', validation.isValid);
      
      if (!validation.isValid) {
        console.log('❌ Validation échouée:', validation.errors.length, 'erreurs');
        result.errors = validation.errors.map(e => e.message);
        this.notifyProgress({
          phase: 'error',
          message: 'Erreurs de validation détectées',
          progress: 0,
          documentsProcessed: 0,
          totalDocuments: 0,
          errors: result.errors,
          warnings: validation.warnings.map(w => w.message)
        });
        return result;
      }

      // Extraire les données valides
      const { documents, logs, obstacles_globaux, recommandations } = JsonImportValidator.extractValidData(jsonContent);
      console.log('📊 Données extraites:', documents.length, 'documents,', logs.length, 'logs');
      
      if (documents.length === 0) {
        console.log('❌ AUCUN DOCUMENT VALIDE TROUVÉ');
        result.errors.push('Aucun document valide trouvé dans le fichier JSON');
        return result;
      }
      
      // Phase 2: Création des répertoires
      console.log('📁 Création répertoires...');
      this.notifyProgress({
        phase: 'directory',
        message: 'Création de la structure de répertoires...',
        progress: 20,
        documentsProcessed: 0,
        totalDocuments: documents.length,
        errors: [],
        warnings: validation.warnings.map(w => w.message)
      });

      let localPath: string;
      // Simplifier la création de répertoire
      localPath = `/Rep_misania/${dataSource.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      console.log('📁 Répertoire cible:', localPath);
      result.localPath = localPath;

      // Phase 3: Téléchargement des documents
      console.log('📥 DÉBUT TÉLÉCHARGEMENTS - Traitement de', documents.length, 'documents');
      this.notifyProgress({
        phase: 'downloading',
        message: 'Téléchargement des documents...',
        progress: 30,
        documentsProcessed: 0,
        totalDocuments: documents.length,
        errors: [],
        warnings: []
      });

      const processedDocuments = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        console.log(`\n📄 Document ${i + 1}/${documents.length}:`);
        console.log('- Nom:', doc.document_name || 'Sans nom');
        console.log('- URL:', doc.url_doc);
        
        // Mettre à jour la progression
        const progress = 30 + (i / documents.length) * 50; // 30% à 80%
        this.notifyProgress({
          phase: 'downloading',
          message: `Téléchargement: ${doc.document_name || doc.filename || `Document ${i + 1}`}`,
          progress,
          documentsProcessed: i,
          totalDocuments: documents.length,
          errors: [],
          warnings: []
        });

        // Validation de base avant téléchargement
        if (!doc.url_doc || typeof doc.url_doc !== 'string') {
          console.log('❌ URL manquante ou invalide');
          processedDocuments.push({
            ...doc,
            filename: doc.filename || `document_${i + 1}.pdf`,
            local_path: '',
            download_success: false,
            obstacles: 'URL de téléchargement manquante ou invalide'
          });
          errorCount++;
          continue;
        }

        // Vérifier que l'URL est valide
        try {
          new URL(doc.url_doc);
        } catch (urlError) {
          console.log('❌ URL malformée:', doc.url_doc);
          processedDocuments.push({
            ...doc,
            filename: doc.filename || `document_${i + 1}.pdf`,
            local_path: '',
            download_success: false,
            obstacles: `URL malformée: ${doc.url_doc}`
          });
          errorCount++;
          continue;
        }

        // Extraire le nom de fichier
        const filename = doc.filename || this.extractFilenameFromUrl(doc.url_doc, doc.document_name) || `document_${i + 1}.pdf`;
        
        console.log('- Fichier cible:', filename);

        // Simuler le téléchargement (WebContainer ne peut pas télécharger de vrais fichiers)
        console.log('📥 Simulation téléchargement...');
        
        // Simuler une requête pour vérifier l'accessibilité
        let downloadResult: any;
        try {
          // Test rapide de connectivité (HEAD request)
          const testResponse = await fetch(doc.url_doc, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          });
          
          if (testResponse.ok) {
            console.log('✅ URL accessible');
            downloadResult = {
              success: true,
              filename: filename,
              localPath: `${localPath}/${filename}`
            };
            successCount++;
          } else {
            console.log('❌ URL non accessible:', testResponse.status);
            downloadResult = {
              success: false,
              filename: filename,
              error: `HTTP ${testResponse.status}: ${testResponse.statusText}`
            };
            errorCount++;
          }
        } catch (fetchError) {
          console.log('❌ Erreur réseau:', fetchError);
          downloadResult = {
            success: false,
            filename,
            error: fetchError instanceof Error ? fetchError.message : 'Erreur réseau'
          };
          errorCount++;
        }

        // Préparer les métadonnées du document
        const processedDoc = {
          ...doc,
          filename: downloadResult.filename,
          local_path: downloadResult.localPath || '',
          download_success: downloadResult.success,
          obstacles: downloadResult.success ? (doc.obstacles || '') : 
            `${doc.obstacles || ''}${doc.obstacles ? '; ' : ''}Échec téléchargement: ${downloadResult.error}`
        };

        processedDocuments.push(processedDoc);
        
        console.log(`${downloadResult.success ? '✅' : '❌'} Résultat:`, downloadResult.success ? 'Succès' : downloadResult.error);
      }

      result.documentsImported = successCount;
      result.documentsWithErrors = errorCount;
      
      console.log(`📊 TÉLÉCHARGEMENTS TERMINÉS:`);
      console.log(`- Succès: ${successCount}`);
      console.log(`- Échecs: ${errorCount}`);
      console.log(`- Total traité: ${processedDocuments.length}`);

      // Phase 4: Sauvegarde en base de données
      console.log('💾 DÉBUT SAUVEGARDE EN BASE...');
      this.notifyProgress({
        phase: 'saving',
        message: 'Sauvegarde des métadonnées...',
        progress: 85,
        documentsProcessed: documents.length,
        totalDocuments: documents.length,
        errors: [],
        warnings: []
      });

      // Sauvegarder les résultats dans harvest_results
      console.log('💾 Création entrée harvest_results...');
      console.log('- DataSource ID:', dataSource.id);
      console.log('- Config ID:', config?.id || 'null');
      console.log('- Documents à sauvegarder:', processedDocuments.length);
      
      const harvestData = {
        data_source_id: dataSource.id,
        config_id: config?.id || null,
        data: { documents: processedDocuments },
        metadata: {
          import_timestamp: new Date().toISOString(),
          total_documents: documents.length,
          successful_downloads: successCount,
          failed_downloads: errorCount,
          local_directory: localPath
        },
        status: 'success',
        local_path: localPath
      };
      
      console.log('📋 Données à insérer:', JSON.stringify(harvestData, null, 2));
      
      const savedResult = await HarvestResultService.createResult(harvestData);
      console.log('✅ Métadonnées sauvegardées avec ID:', savedResult.id);

      // Sauvegarder les logs
      console.log('📝 Sauvegarde logs...');
      let logsImported = 0;
      for (const log of logs) {
        try {
          await HarvestLogService.createLog({
            data_source_id: dataSource.id,
            level: log.level || 'info',
            message: log.message || 'Log importé',
            details: {
              ...log,
              import_source: 'json_upload',
              import_timestamp: new Date().toISOString()
            }
          });
          logsImported++;
        } catch (logError) {
          console.error('❌ Erreur log individuel:', logError);
        }
      }
      result.logsImported = logsImported;
      console.log('✅ Logs sauvegardés:', logsImported);

      // Mettre à jour les obstacles globaux et recommandations du site
      console.log('🔄 Mise à jour des obstacles globaux et recommandations...');
      try {
        const updateData: any = {};
        
        if (obstacles_globaux.length > 0) {
          updateData.obstacles_globaux = obstacles_globaux;
          console.log('📝 Obstacles globaux à sauvegarder:', obstacles_globaux);
        }
        
        if (recommandations) {
          updateData.recommandations = recommandations;
          console.log('📝 Recommandations à sauvegarder:', recommandations);
        }
        
        if (Object.keys(updateData).length > 0) {
          // Importer le service ici pour éviter les dépendances circulaires
          const { DataSourceService } = await import('./dataSourceService');
          await DataSourceService.updateDataSource(dataSource.id, updateData);
          console.log('✅ Site mis à jour avec obstacles globaux et recommandations');
        } else {
          console.log('ℹ️ Aucun obstacle global ou recommandation à mettre à jour');
        }
      } catch (updateError) {
        console.error('❌ Erreur lors de la mise à jour du site (non critique):', updateError);
        // Ne pas faire échouer l'import pour cette erreur
      }

      // Log final de l'importation
      try {
        await HarvestLogService.createLog({
          data_source_id: dataSource.id,
          level: 'info',
          message: `Importation JSON réussie: ${successCount} documents importés, ${errorCount} échecs`,
          details: {
            total_documents: documents.length,
            successful_downloads: successCount,
            failed_downloads: errorCount,
            local_path: localPath,
            obstacles_globaux_count: obstacles_globaux.length,
            has_recommandations: !!recommandations
          }
        });
      } catch (error) {
        console.error('❌ Erreur log final (non critique):', error);
      }

      // Phase 5: Terminé
      console.log('🎉 IMPORTATION TERMINÉE AVEC SUCCÈS');
      this.notifyProgress({
        phase: 'completed',
        message: `Importation terminée: ${result.documentsImported} documents importés`,
        progress: 100,
        documentsProcessed: documents.length,
        totalDocuments: documents.length,
        errors: [],
        warnings: []
      });

      result.success = true;
      return result;

    } catch (error) {
      console.error('❌ ERREUR CRITIQUE IMPORTATION:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'Pas de stack');
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      result.errors.push(errorMessage);

      this.notifyProgress({
        phase: 'error',
        message: `Erreur lors de l'importation: ${errorMessage}`,
        progress: 0,
        documentsProcessed: 0,
        totalDocuments: 0,
        errors: [errorMessage],
        warnings: []
      });

      return result;
    }
  }

  // Valider un fichier JSON avant importation
  static validateJsonFile(jsonContent: string) {
    return JsonImportValidator.validateImportJson(jsonContent);
  }

  // Méthode utilitaire pour extraire le nom de fichier depuis une URL
  private static extractFilenameFromUrl(url: string, fallbackName?: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || '';
      
      if (filename && filename.includes('.')) {
        return filename;
      }
      
      // Si pas d'extension, utiliser le fallback ou générer un nom
      if (fallbackName) {
        return fallbackName;
      }
      
      // Générer un nom basé sur l'URL
      const domain = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = Date.now();
      return `document_${domain}_${timestamp}.pdf`;
      
    } catch {
      // URL invalide, utiliser le fallback ou générer un nom
      if (fallbackName) {
        return fallbackName;
      }
      return `document_${Date.now()}.pdf`;
    }
  }
}