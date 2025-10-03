/*
  # Ajouter contrainte d'unicité sur le nom des sources de données

  1. Modifications
    - Ajouter contrainte UNIQUE sur le champ 'name' de la table 'data_sources'
    - Créer un index pour optimiser les performances
    - Garantir l'intégrité des répertoires de téléchargement

  2. Sécurité
    - Maintenir les politiques RLS existantes
    - Aucun impact sur les données existantes
*/

-- Ajouter la contrainte d'unicité sur le nom des sources de données
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'unique_data_source_name' 
    AND table_name = 'data_sources'
  ) THEN
    ALTER TABLE data_sources ADD CONSTRAINT unique_data_source_name UNIQUE (name);
  END IF;
END $$;

-- Créer un index pour optimiser les recherches par nom
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_data_sources_name_unique'
  ) THEN
    CREATE INDEX idx_data_sources_name_unique ON data_sources (name);
  END IF;
END $$;