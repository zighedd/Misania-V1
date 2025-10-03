/*
  # Ajouter contrainte d'unicité sur le nom des sources de données

  1. Contraintes
    - Ajouter contrainte UNIQUE sur le champ `name` de la table `data_sources`
    - Créer un index pour optimiser les performances de vérification d'unicité
  
  2. Sécurité
    - Garantir l'intégrité des répertoires de stockage
    - Éviter les conflits de noms lors de l'importation
*/

-- Ajouter la contrainte d'unicité sur le nom des sources de données
ALTER TABLE data_sources 
ADD CONSTRAINT unique_data_source_name UNIQUE (name);

-- Créer un index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_data_sources_name_unique 
ON data_sources (name);