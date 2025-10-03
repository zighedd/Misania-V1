/*
  # Ajouter la colonne special_instructions à la table data_sources

  1. Modifications
    - Ajouter la colonne `special_instructions` de type text à la table `data_sources`
    - Cette colonne stockera les consignes et instructions particulières pour chaque site
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_sources' AND column_name = 'special_instructions'
  ) THEN
    ALTER TABLE data_sources ADD COLUMN special_instructions text DEFAULT '';
  END IF;
END $$;