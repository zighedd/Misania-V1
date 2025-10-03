import { HarvestResultService } from '../services/harvestResultService';

export async function checkEmbeddingsStorage() {
  try {
    console.log('🔍 VÉRIFICATION DES EMBEDDINGS SAUVEGARDÉS');
    console.log('='.repeat(60));
    
    // Récupérer tous les résultats récents
    const results = await HarvestResultService.getAllResults(20);
    console.log(`📊 ${results.length} résultats de moissonnage trouvés`);
    
    let embeddingsCount = 0;
    let analysisCount = 0;
    
    results.forEach((result, index) => {
      console.log(`\n📄 Résultat ${index + 1}:`);
      console.log(`- ID: ${result.id}`);
      console.log(`- Date: ${new Date(result.harvested_at).toLocaleString('fr-FR')}`);
      console.log(`- Statut: ${result.status}`);
      
      // Vérifier l'analyse
      const hasAnalysis = !!result.analysis_completed_at;
      if (hasAnalysis) {
        analysisCount++;
        console.log(`✅ Analyse présente:`);
        console.log(`  - Résumé: ${result.analysis_summary ? 'Oui' : 'Non'}`);
        console.log(`  - Mots-clés: ${result.analysis_keywords ? (result.analysis_keywords as string[]).length : 0}`);
        console.log(`  - Date analyse: ${new Date(result.analysis_completed_at).toLocaleString('fr-FR')}`);
      } else {
        console.log(`❌ Pas d'analyse`);
      }
      
      // Vérifier les embeddings dans metadata
      const metadata = result.metadata as any;
      if (metadata && metadata.embedding) {
        embeddingsCount++;
        console.log(`✅ EMBEDDINGS TROUVÉS:`);
        console.log(`  - Modèle: ${metadata.embedding.embedding_model || 'Non spécifié'}`);
        console.log(`  - Dimensions: ${metadata.embedding.embedding ? metadata.embedding.embedding.length : 'Erreur'}`);
        console.log(`  - Hash texte: ${metadata.embedding.text_hash ? metadata.embedding.text_hash.substring(0, 12) + '...' : 'Non spécifié'}`);
        console.log(`  - Longueur texte: ${metadata.embedding.text_length || 'Non spécifié'} caractères`);
        console.log(`  - Date création: ${metadata.embedding.created_at || 'Non spécifiée'}`);
        
        // Vérifier la validité du vecteur
        if (metadata.embedding.embedding && Array.isArray(metadata.embedding.embedding)) {
          const vector = metadata.embedding.embedding;
          const isValidVector = vector.length === 1536 && vector.every((v: any) => typeof v === 'number');
          console.log(`  - Vecteur valide: ${isValidVector ? '✅ OUI' : '❌ NON'}`);
          
          if (isValidVector) {
            // Afficher quelques valeurs pour vérification
            console.log(`  - Échantillon vecteur: [${vector.slice(0, 3).map((v: number) => v.toFixed(4)).join(', ')}...]`);
            console.log(`  - Norme du vecteur: ${Math.sqrt(vector.reduce((sum: number, v: number) => sum + v * v, 0)).toFixed(4)}`);
          }
        } else {
          console.log(`  - ❌ Vecteur invalide ou manquant`);
        }
      } else {
        console.log(`❌ Pas d'embeddings`);
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ:');
    console.log(`- Total résultats: ${results.length}`);
    console.log(`- Avec analyse: ${analysisCount}`);
    console.log(`- Avec embeddings: ${embeddingsCount}`);
    console.log(`- Taux embeddings: ${results.length > 0 ? Math.round((embeddingsCount / results.length) * 100) : 0}%`);
    
    if (embeddingsCount > 0) {
      console.log('\n✅ EMBEDDINGS DÉTECTÉS - Recherche sémantique possible !');
    } else {
      console.log('\n⚠️ AUCUN EMBEDDING DÉTECTÉ - Lancez une analyse complète');
    }
    
    return {
      totalResults: results.length,
      withAnalysis: analysisCount,
      withEmbeddings: embeddingsCount,
      embeddingsRate: results.length > 0 ? (embeddingsCount / results.length) * 100 : 0
    };
    
  } catch (error) {
    console.error('❌ ERREUR lors de la vérification:', error);
    return null;
  }
}

// Fonction pour tester la similarité entre deux documents (si embeddings présents)
export async function testSemanticSimilarity() {
  try {
    console.log('\n🔍 TEST DE SIMILARITÉ SÉMANTIQUE');
    console.log('='.repeat(50));
    
    const results = await HarvestResultService.getAllResults(10);
    const resultsWithEmbeddings = results.filter(r => {
      const metadata = r.metadata as any;
      return metadata && metadata.embedding && metadata.embedding.embedding;
    });
    
    if (resultsWithEmbeddings.length < 2) {
      console.log('⚠️ Besoin d\'au moins 2 documents avec embeddings pour tester la similarité');
      return;
    }
    
    console.log(`📊 ${resultsWithEmbeddings.length} documents avec embeddings trouvés`);
    
    // Calculer la similarité entre les 2 premiers documents
    const doc1 = resultsWithEmbeddings[0];
    const doc2 = resultsWithEmbeddings[1];
    
    const embedding1 = (doc1.metadata as any).embedding.embedding;
    const embedding2 = (doc2.metadata as any).embedding.embedding;
    
    // Calcul de similarité cosinus
    const similarity = calculateCosineSimilarity(embedding1, embedding2);
    
    console.log('\n📊 RÉSULTAT DU TEST:');
    console.log(`Document 1: ${doc1.id.substring(0, 8)}... (${new Date(doc1.harvested_at).toLocaleDateString('fr-FR')})`);
    console.log(`Document 2: ${doc2.id.substring(0, 8)}... (${new Date(doc2.harvested_at).toLocaleDateString('fr-FR')})`);
    console.log(`Similarité: ${(similarity * 100).toFixed(2)}%`);
    
    if (similarity > 0.8) {
      console.log('🎯 Documents très similaires !');
    } else if (similarity > 0.6) {
      console.log('🔍 Documents modérément similaires');
    } else {
      console.log('📝 Documents différents');
    }
    
    return similarity;
    
  } catch (error) {
    console.error('❌ Erreur test similarité:', error);
    return null;
  }
}

// Fonction utilitaire pour calculer la similarité cosinus
function calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Les vecteurs doivent avoir la même dimension');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Exécuter la vérification automatiquement
console.log('🚀 Lancement de la vérification des embeddings...');
checkEmbeddingsStorage().then(stats => {
  if (stats && stats.withEmbeddings > 0) {
    console.log('\n🧪 Test de similarité sémantique...');
    testSemanticSimilarity();
  }
});