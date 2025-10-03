import { DataSourceService } from '../services/dataSourceService';
import { HarvestingConfigService } from '../services/harvestingConfigService';

export async function generatePromptById(siteId: string) {
  try {
    console.log(`🔍 Récupération des données pour le site ID: ${siteId}`);
    
    // Récupérer le site par ID
    const site = await DataSourceService.getDataSourceById(siteId);
    
    if (!site) {
      console.log(`❌ Site avec l'ID "${siteId}" non trouvé dans la base de données`);
      return `Erreur: Site avec l'ID "${siteId}" non trouvé`;
    }

    console.log(`✅ Site trouvé:`, site.name);
    console.log('URL:', site.url);
    console.log('Type:', site.type);
    console.log('Statut:', site.status);
    
    // Récupérer la configuration de moissonnage
    const configs = await HarvestingConfigService.getConfigsByDataSource(site.id);
    const config = configs[0];
    
    if (!config) {
      console.log('⚠️ Aucune configuration de moissonnage trouvée pour ce site');
      return `Je voudrais moissonner le site ${site.url} mais aucune configuration n'est définie.`;
    }

    console.log('✅ Configuration trouvée');
    console.log('Fréquence:', config.frequency);
    console.log('Pages max:', config.max_pages);
    console.log('Délai:', config.delay_between_requests);

    // Extraire les données de configuration
    const selectors = (config.selectors as any) || {};
    const filters = (config.filters as any) || {};

    // Construire le prompt utilisateur naturel
    let prompt = `Je voudrais moissonner le site ${site.url}`;

    // Ajouter les formats de documents
    if (selectors.documentFormats && selectors.documentFormats.length > 0) {
      prompt += ` pour récupérer les documents de type ${selectors.documentFormats.join(', ')}`;
    }

    // Ajouter la plage de dates
    if (selectors.dateRange?.start && selectors.dateRange?.end) {
      const startDate = new Date(selectors.dateRange.start).toLocaleDateString('fr-FR');
      const endDate = new Date(selectors.dateRange.end).toLocaleDateString('fr-FR');
      prompt += ` du ${startDate} au ${endDate}`;
    } else if (selectors.dateRange?.start) {
      const startDate = new Date(selectors.dateRange.start).toLocaleDateString('fr-FR');
      prompt += ` à partir du ${startDate}`;
    } else if (selectors.dateRange?.end) {
      const endDate = new Date(selectors.dateRange.end).toLocaleDateString('fr-FR');
      prompt += ` jusqu'au ${endDate}`;
    }

    // Ajouter les langues
    if (selectors.languages && selectors.languages.length > 0) {
      const languesFr = selectors.languages.map((lang: string) => {
        switch (lang) {
          case 'FR': return 'français';
          case 'EN': return 'anglais';
          case 'AR': return 'arabe';
          case 'ES': return 'espagnol';
          case 'DE': return 'allemand';
          case 'IT': return 'italien';
          default: return lang.toLowerCase();
        }
      });
      prompt += ` en langue ${languesFr.join(' et ')}`;
    }

    // Ajouter les mots-clés à inclure
    if (filters.keywords && filters.keywords.trim()) {
      prompt += `. Je veux uniquement les documents contenant les mots-clés suivants : ${filters.keywords}`;
    }

    // Ajouter les mots-clés à exclure
    if (filters.excludeKeywords && filters.excludeKeywords.trim()) {
      prompt += `. Exclure les documents contenant : ${filters.excludeKeywords}`;
    }

    // Ajouter les contraintes de taille
    if (filters.minSize || filters.maxSize) {
      prompt += '. Contraintes de taille :';
      if (filters.minSize) {
        prompt += ` minimum ${filters.minSize}MB`;
      }
      if (filters.maxSize) {
        if (filters.minSize) prompt += ' et';
        prompt += ` maximum ${filters.maxSize}MB`;
      }
    }

    // Ajouter les paramètres techniques
    prompt += `. Paramètres techniques : collecter maximum ${config.max_pages} documents avec un délai de ${config.delay_between_requests}ms entre chaque requête`;

    // Ajouter la fréquence si ce n'est pas manuel
    if (config.frequency !== 'manual') {
      const frequencyText = {
        'daily': 'quotidienne',
        'weekly': 'hebdomadaire',
        'monthly': 'mensuelle'
      }[config.frequency] || config.frequency;
      prompt += `. Planifier une exécution ${frequencyText}`;
    }

    prompt += '.';

    console.log('\n📋 PROMPT UTILISATEUR GÉNÉRÉ POUR LE SITE ID:', siteId);
    console.log('='.repeat(80));
    console.log(prompt);
    console.log('='.repeat(80));
    
    return prompt;
  } catch (error) {
    console.error('❌ Erreur lors de la génération du prompt:', error);
    return `Erreur lors de la génération du prompt: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
  }
}

// Fonction pour exécuter la génération avec gestion d'erreur améliorée
export async function executePromptGeneration() {
  try {
    console.log('🚀 DÉBUT DE LA GÉNÉRATION DU PROMPT');
    console.log('ID du site cible: 2915782d-1f64-4da2-9693-6c400db6d947');
    
    const prompt = await generatePromptById('2915782d-1f64-4da2-9693-6c400db6d947');
    
    console.log('\n✅ PROMPT GÉNÉRÉ AVEC SUCCÈS');
    console.log('='.repeat(80));
    console.log('PROMPT FINAL:');
    console.log('='.repeat(80));
    console.log(prompt);
    console.log('='.repeat(80));
    
    return prompt;
  } catch (error) {
    console.error('❌ ERREUR LORS DE LA GÉNÉRATION:', error);
    return null;
  }
}

// Exécuter après un délai pour s'assurer que Supabase est initialisé
setTimeout(() => {
  executePromptGeneration();
}, 2000);