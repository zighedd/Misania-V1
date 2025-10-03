/*
  # Ajouter colonne local_path à harvest_results

  1. Modifications
    - Ajouter la colonne `local_path` (text, nullable) à la table `harvest_results`
    - Cette colonne stockera le chemin local des documents téléchargés
    - Exemple: "/documents/zighed.com/D-A-Zighed-Rapp-Activite.pdf"

  2. Notes
    - La colonne est nullable car les anciens enregistrements n'auront pas de chemin local
    - Les nouveaux moissonnages pourront renseigner cette colonne après téléchargement
*/

-- Ajouter la colonne local_path à la table harvest_results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'harvest_results' AND column_name = 'local_path'
  ) THEN
    ALTER TABLE harvest_results ADD COLUMN local_path text;
  END IF;
END $$;