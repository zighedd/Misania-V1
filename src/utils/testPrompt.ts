import { PromptGenerator } from './promptGenerator';

// Fonction pour tester la génération du prompt
export async function testPromptGeneration() {
  try {
    console.log('=== GÉNÉRATION DU PROMPT POUR LE SITE "TPU" ===\n');
    
    const prompt = await PromptGenerator.generateHarvestingPrompt('tpu');
    
    console.log(prompt);
    console.log('\n=== FIN DU PROMPT ===');
    
    return prompt;
  } catch (error) {
    console.error('Erreur lors de la génération du prompt:', error);
    return null;
  }
}

// Appeler la fonction de test
testPromptGeneration();