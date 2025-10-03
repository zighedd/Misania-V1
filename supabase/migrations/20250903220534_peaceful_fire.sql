/*
  # Add analysis cache columns to harvest_results

  1. New Columns
    - `analysis_summary` (text) - Résumé généré par l'IA
    - `analysis_keywords` (jsonb) - Mots-clés sous forme de tableau JSON
    - `analysis_completed_at` (timestamp) - Date de l'analyse pour éviter les re-analyses

  2. Safety
    - Colonnes optionnelles (nullable) pour compatibilité avec données existantes
    - Pas de modification des données existantes
    - Index pour optimiser les requêtes
*/

-- Ajouter les colonnes d'analyse de manière sécurisée
DO $$
BEGIN
  -- Vérifier et ajouter analysis_summary
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'harvest_results' AND column_name = 'analysis_summary'
  ) THEN
    ALTER TABLE harvest_results ADD COLUMN analysis_summary text DEFAULT NULL;
  END IF;

  -- Vérifier et ajouter analysis_keywords
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'harvest_results' AND column_name = 'analysis_keywords'
  ) THEN
    ALTER TABLE harvest_results ADD COLUMN analysis_keywords jsonb DEFAULT NULL;
  END IF;

  -- Vérifier et ajouter analysis_completed_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'harvest_results' AND column_name = 'analysis_completed_at'
  ) THEN
    ALTER TABLE harvest_results ADD COLUMN analysis_completed_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Ajouter un index pour optimiser les requêtes d'analyse
CREATE INDEX IF NOT EXISTS idx_harvest_results_analysis_completed 
ON harvest_results (analysis_completed_at) 
WHERE analysis_completed_at IS NOT NULL;

-- Ajouter un index pour la recherche par mots-clés
CREATE INDEX IF NOT EXISTS idx_harvest_results_keywords 
ON harvest_results USING gin (analysis_keywords) 
WHERE analysis_keywords IS NOT NULL;