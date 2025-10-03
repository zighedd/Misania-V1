import { DataSourceService } from '../services/dataSourceService';
import { HarvestingConfigService } from '../services/harvestingConfigService';

export async function checkMoiSiteData() {
  try {
    console.log('🔍 Vérification de l\'accès aux données du site "moi"...\n');
    
    // Récupérer tous les sites
    const allSources = await DataSourceService.getAllDataSources();
    console.log('📊 Nombre total de sites dans la BD:', allSources.length);
    console.log('📋 Liste des sites:', allSources.map(s => s.name));
    
    // Chercher le site "moi"
    const moiSite = allSources.find(s => s.name.toLowerCase() === 'moi');
    
    if (!moiSite) {
      console.log('❌ Site "moi" NON TROUVÉ dans la base de données');
      return false;
    }
    
    console.log('✅ Site "moi" TROUVÉ:');
    console.log('- ID:', moiSite.id);
    console.log('- Nom:', moiSite.name);
    console.log('- URL:', moiSite.url);
    console.log('- Type:', moiSite.type);
    console.log('- Statut:', moiSite.status);
    console.log('- Description:', moiSite.description);
    
    // Vérifier la configuration
    const configs = await HarvestingConfigService.getConfigsByDataSource(moiSite.id);
    console.log('\n🔧 Configurations trouvées:', configs.length);
    
    if (configs.length > 0) {
      const config = configs[0];
      console.log('✅ Configuration trouvée:');
      console.log('- ID:', config.id);
      console.log('- Fréquence:', config.frequency);
      console.log('- Pages max:', config.max_pages);
      console.log('- Délai:', config.delay_between_requests);
      console.log('- Sélecteurs:', config.selectors);
      console.log('- Filtres:', config.filters);
    } else {
      console.log('⚠️ Aucune configuration trouvée pour ce site');
    }
    
    return true;
  } catch (error) {
    console.error('❌ ERREUR lors de la vérification:', error);
    return false;
  }
}

// Exécuter la vérification
checkMoiSiteData().then(success => {
  if (success) {
    console.log('\n✅ ACCÈS AUX DONNÉES CONFIRMÉ');
  } else {
    console.log('\n❌ ÉCHEC DE L\'ACCÈS AUX DONNÉES');
  }
});