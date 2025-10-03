import { DataSourceService } from '../services/dataSourceService';
import { HarvestingConfigService } from '../services/harvestingConfigService';
import type { Database } from '../lib/database.types';

type DataSource = Database['public']['Tables']['data_sources']['Row'];
type HarvestingConfig = Database['public']['Tables']['harvesting_configs']['Row'];

export class PromptGenerator {
  static async generateHarvestingPrompt(siteName: string): Promise<string> {
    try {
      // Récupérer le site par nom
      const allSources = await DataSourceService.getAllDataSources();
      const site = allSources.find(s => s.name.toLowerCase() === siteName.toLowerCase());
      
      if (!site) {
        throw new Error(`Site "${siteName}" non trouvé dans la base de données`);
      }

      // Récupérer la configuration de moissonnage
      const configs = await HarvestingConfigService.getConfigsByDataSource(site.id);
      const config = configs[0]; // Prendre la première configuration

      // Générer l'ID de session et timestamp
      const sessionId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      // Extraire les données de configuration
      const selectors = (config?.selectors as any) || {};
      const filters = (config?.filters as any) || {};

      const prompt = `SYSTÈME DE MOISSONNAGE MISSANIA-MOISSON
=======================================

CONFIGURATION DE MOISSONNAGE
Site cible : ${site.name}
URL : ${site.url}
Type de source : ${site.type}
Statut : ${site.status}
Description : ${site.description || 'Aucune description'}

PARAMÈTRES DE PLANIFICATION
---------------------------
Fréquence : ${config?.frequency || 'manual'}
Pages maximum : ${config?.max_pages || 10}
Délai entre requêtes : ${config?.delay_between_requests || 1000}ms
Date de début : ${selectors.dateRange?.start || 'Non définie'}
Date de fin : ${selectors.dateRange?.end || 'Non définie'}

CRITÈRES DE SÉLECTION
---------------------
Formats de documents acceptés : ${selectors.documentFormats?.join(', ') || 'pdf, docx'}
Langues acceptées : ${selectors.languages?.join(', ') || 'FR'}

SÉLECTEURS CSS
--------------
Sélecteur de titre : ${selectors.titleSelector || 'h1, .title, .document-title'}
Sélecteur de contenu : ${selectors.contentSelector || '.content, article, .main-content'}
Sélecteur de date : ${selectors.dateSelector || '.date, time, .publish-date'}
Sélecteur de liens : ${selectors.linkSelector || 'a[href$=\\'.pdf\\'], a[href$=\\'.docx\\']'}

FILTRES DE CONTENU
------------------
Mots-clés à inclure : ${filters.keywords || 'Tous documents'}
Mots-clés à exclure : ${filters.excludeKeywords || 'Aucun'}
Taille minimum : ${filters.minSize || '0'}MB
Taille maximum : ${filters.maxSize || 'Illimitée'}MB

INSTRUCTIONS D'EXÉCUTION
------------------------
1. Analyser la structure du site web cible : ${site.url}
2. Appliquer les sélecteurs CSS pour identifier les éléments
3. Extraire les documents correspondant aux critères définis
4. Respecter le délai de ${config?.delay_between_requests || 1000}ms entre chaque requête
5. Limiter le scan à ${config?.max_pages || 10} pages maximum
6. Filtrer selon les formats (${selectors.documentFormats?.join(', ') || 'pdf, docx'}) et langue (${selectors.languages?.join(', ') || 'FR'})
7. Enregistrer chaque résultat dans harvest_results avec metadata complète
8. Logger toutes les opérations (succès/erreurs) dans harvest_logs
9. Signaler immédiatement tout incident ou erreur rencontré

DÉBUT DU PROCESSUS DE MOISSONNAGE
ID de session : ${sessionId}
Timestamp : ${timestamp}
Data Source ID : ${site.id}
Config ID : ${config?.id || 'Aucune configuration'}`;

      return prompt;
    } catch (error) {
      throw new Error(`Erreur lors de la génération du prompt: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }
}
    prompt += `. Paramètres techniques : collecter maximum ${config?.max_pages || 10} documents avec un délai de ${config?.delay_between_requests || 1000}ms entre chaque requête`;