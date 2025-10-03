/*
  # Ajouter colonnes obstacles_globaux et recommandations

  1. Nouvelles colonnes
    - `obstacles_globaux` (jsonb) - Tableau des obstacles rencontrés lors du moissonnage
    - `recommandations` (text, nullable) - Recommandations pour améliorer le moissonnage

  2. Sécurité
    - Pas de changement RLS nécessaire (hérite des politiques existantes)
*/

-- Ajouter la colonne obstacles_globaux (tableau JSON)
ALTER TABLE data_sources 
ADD COLUMN IF NOT EXISTS obstacles_globaux jsonb DEFAULT '[]'::jsonb;

-- Ajouter la colonne recommandations (texte nullable)
ALTER TABLE data_sources 
ADD COLUMN IF NOT EXISTS recommandations text DEFAULT NULL;