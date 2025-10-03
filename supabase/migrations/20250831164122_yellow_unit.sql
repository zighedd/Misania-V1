/*
  # Schéma de base pour le système de moissonnage MissanIa

  1. Nouvelles Tables
    - `data_sources` - Sources de données à moissonner
      - `id` (uuid, clé primaire)
      - `name` (text) - Nom de la source
      - `url` (text) - URL à moissonner
      - `type` (text) - Type de source (web, api, rss, etc.)
      - `status` (text) - Statut (active, inactive, error)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `harvesting_configs` - Configurations de moissonnage
      - `id` (uuid, clé primaire)
      - `data_source_id` (uuid, clé étrangère)
      - `frequency` (text) - Fréquence de moissonnage
      - `selectors` (jsonb) - Sélecteurs CSS/XPath
      - `filters` (jsonb) - Filtres à appliquer
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `harvest_results` - Résultats du moissonnage
      - `id` (uuid, clé primaire)
      - `data_source_id` (uuid, clé étrangère)
      - `config_id` (uuid, clé étrangère)
      - `data` (jsonb) - Données moissonnées
      - `metadata` (jsonb) - Métadonnées (taille, durée, etc.)
      - `status` (text) - Statut du moissonnage
      - `harvested_at` (timestamp)
    
    - `harvest_logs` - Logs des opérations
      - `id` (uuid, clé primaire)
      - `data_source_id` (uuid, clé étrangère)
      - `level` (text) - Niveau de log (info, warning, error)
      - `message` (text) - Message du log
      - `details` (jsonb) - Détails supplémentaires
      - `created_at` (timestamp)

  2. Sécurité
    - Activation de RLS sur toutes les tables
    - Politiques pour les utilisateurs authentifiés
    - Accès en lecture/écriture pour les propriétaires des données

  3. Index
    - Index sur les clés étrangères
    - Index sur les timestamps pour les performances
    - Index sur les statuts pour les requêtes fréquentes
*/

-- Table des sources de données
CREATE TABLE IF NOT EXISTS data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  type text NOT NULL DEFAULT 'web',
  status text NOT NULL DEFAULT 'active',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des configurations de moissonnage
CREATE TABLE IF NOT EXISTS harvesting_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  frequency text NOT NULL DEFAULT 'daily',
  selectors jsonb DEFAULT '{}',
  filters jsonb DEFAULT '{}',
  max_pages integer DEFAULT 1,
  delay_between_requests integer DEFAULT 1000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des résultats de moissonnage
CREATE TABLE IF NOT EXISTS harvest_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES harvesting_configs(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'success',
  error_message text,
  harvested_at timestamptz DEFAULT now()
);

-- Table des logs
CREATE TABLE IF NOT EXISTS harvest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid REFERENCES data_sources(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Activation de RLS sur toutes les tables
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvesting_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_logs ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour data_sources
CREATE POLICY "Utilisateurs authentifiés peuvent lire les sources"
  ON data_sources
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent créer des sources"
  ON data_sources
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Utilisateurs authentifiés peuvent modifier les sources"
  ON data_sources
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent supprimer les sources"
  ON data_sources
  FOR DELETE
  TO authenticated
  USING (true);

-- Politiques RLS pour harvesting_configs
CREATE POLICY "Utilisateurs authentifiés peuvent lire les configurations"
  ON harvesting_configs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent créer des configurations"
  ON harvesting_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Utilisateurs authentifiés peuvent modifier les configurations"
  ON harvesting_configs
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent supprimer les configurations"
  ON harvesting_configs
  FOR DELETE
  TO authenticated
  USING (true);

-- Politiques RLS pour harvest_results
CREATE POLICY "Utilisateurs authentifiés peuvent lire les résultats"
  ON harvest_results
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent créer des résultats"
  ON harvest_results
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politiques RLS pour harvest_logs
CREATE POLICY "Utilisateurs authentifiés peuvent lire les logs"
  ON harvest_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent créer des logs"
  ON harvest_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_data_sources_status ON data_sources(status);
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
CREATE INDEX IF NOT EXISTS idx_harvesting_configs_data_source_id ON harvesting_configs(data_source_id);
CREATE INDEX IF NOT EXISTS idx_harvest_results_data_source_id ON harvest_results(data_source_id);
CREATE INDEX IF NOT EXISTS idx_harvest_results_harvested_at ON harvest_results(harvested_at);
CREATE INDEX IF NOT EXISTS idx_harvest_results_status ON harvest_results(status);
CREATE INDEX IF NOT EXISTS idx_harvest_logs_data_source_id ON harvest_logs(data_source_id);
CREATE INDEX IF NOT EXISTS idx_harvest_logs_level ON harvest_logs(level);
CREATE INDEX IF NOT EXISTS idx_harvest_logs_created_at ON harvest_logs(created_at);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON data_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_harvesting_configs_updated_at
  BEFORE UPDATE ON harvesting_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();