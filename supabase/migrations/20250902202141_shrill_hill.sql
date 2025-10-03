/*
  # Ajouter la colonne generated_prompt à la table data_sources

  1. Modifications
    - Ajouter la colonne `generated_prompt` de type `text` à la table `data_sources`
    - Valeur par défaut : chaîne vide
    - Permet de stocker le prompt généré de manière persistante
*/

ALTER TABLE data_sources 
ADD COLUMN generated_prompt text DEFAULT '' NOT NULL;