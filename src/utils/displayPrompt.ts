import { DataSourceService } from '../services/dataSourceService';
import { HarvestingConfigService } from '../services/harvestingConfigService';

export async function displayPromptForTPU() {
  try {
    console.log('🔍 Recherche du site "tpu" dans la base de données...\n');
    
    // Récupérer tous les sites pour trouver "tpu"
    const allSources = await DataSourceService.getAllDataSources();
    const site = allSources.find(s => s.name.toLowerCase() === 'tpu');
    
    if (!site) {
      console.log('❌ Site "tpu" non trouvé dans la base de données');
      console.log('Sites disponibles:', allSources.map(s => s.name));
      return;
    }

    console.log('✅ Site "tpu" trouvé:', site.name);
    console.log('URL:', site.url);
    
    // Récupérer la configuration de moissonnage
    const configs = await HarvestingConfigService.getConfigsByDataSource(site.id);
    const config = configs[0];
    
    if (!config) {
      console.log('⚠️ Aucune configuration de moissonnage trouvée pour ce site');
    }

    // Générer l'ID de session et timestamp
    const sessionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Extraire les données de configuration
    const selectors = (config?.selectors as any) || {};
    const filters = (config?.filters as any) || {};

    // Générer le prompt complet
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
6. Collecter maximum ${config?.max_pages || 10} documents selon les formats (${selectors.documentFormats?.join(', ') || 'pdf, docx'}) et langue (${selectors.languages?.join(', ') || 'FR'})
7. Enregistrer chaque résultat dans harvest_results avec metadata complète
8. Logger toutes les opérations (succès/erreurs) dans harvest_logs
9. Signaler immédiatement tout incident ou erreur rencontré

DÉBUT DU PROCESSUS DE MOISSONNAGE
ID de session : ${sessionId}
Timestamp : ${timestamp}
Data Source ID : ${site.id}
Config ID : ${config?.id || 'Aucune configuration'}`;

    console.log('\n📋 PROMPT UTILISATEUR GÉNÉRÉ :\n');
    console.log('='.repeat(80));
    console.log(prompt);
    console.log('='.repeat(80));
    
    return prompt;
  } catch (error) {
    console.error('❌ Erreur lors de la génération du prompt:', error);
    return null;
  }
}

// Exécuter la fonction
displayPromptForTPU();