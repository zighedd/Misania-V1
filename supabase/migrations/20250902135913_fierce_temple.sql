/*
  # Restauration complète du schéma MissanIa-Moisson V3

  1. Nettoyage complet
     - Suppression de toutes les tables existantes
     - Suppression des fonctions et triggers

  2. Nouvelles Tables
     - `data_sources` - Sources de données à moissonner
     - `harvesting_configs` - Configurations de moissonnage
     - `harvest_results` - Résultats des moissonnages
     - `harvest_logs` - Logs du système

  3. Sécurité
     - RLS activé sur toutes les tables
     - Politiques d'accès public pour développement

  4. Données de test
     - Sources de test pour validation
     - Configuration exemple
     - Log d'initialisation
*/

-- Supprimer les tables existantes si elles existent (nettoyage complet)
DROP TABLE IF EXISTS public.harvest_results CASCADE;
DROP TABLE IF EXISTS public.harvest_logs CASCADE;
DROP TABLE IF EXISTS public.harvesting_configs CASCADE;
DROP TABLE IF EXISTS public.data_sources CASCADE;

-- Supprimer la fonction trigger si elle existe
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Créer la fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- TABLE: data_sources
-- =====================================================
CREATE TABLE public.data_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    url text NOT NULL,
    type text DEFAULT 'web' NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    description text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index pour améliorer les performances
CREATE UNIQUE INDEX unique_data_source_name ON public.data_sources(name);
CREATE INDEX idx_data_sources_status ON public.data_sources(status);
CREATE INDEX idx_data_sources_type ON public.data_sources(type);

-- Trigger pour updated_at
CREATE TRIGGER update_data_sources_updated_at
    BEFORE UPDATE ON public.data_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS et politiques
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to data_sources"
    ON public.data_sources
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- TABLE: harvesting_configs
-- =====================================================
CREATE TABLE public.harvesting_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
    frequency text DEFAULT 'daily' NOT NULL,
    selectors jsonb DEFAULT '{}',
    filters jsonb DEFAULT '{}',
    max_pages integer DEFAULT 1,
    delay_between_requests integer DEFAULT 1000,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX idx_harvesting_configs_data_source_id ON public.harvesting_configs(data_source_id);

-- Trigger pour updated_at
CREATE TRIGGER update_harvesting_configs_updated_at
    BEFORE UPDATE ON public.harvesting_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS et politiques
ALTER TABLE public.harvesting_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to harvesting_configs"
    ON public.harvesting_configs
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- TABLE: harvest_results
-- =====================================================
CREATE TABLE public.harvest_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
    config_id uuid NOT NULL REFERENCES public.harvesting_configs(id) ON DELETE CASCADE,
    data jsonb DEFAULT '{}' NOT NULL,
    metadata jsonb DEFAULT '{}',
    status text DEFAULT 'success' NOT NULL,
    error_message text,
    harvested_at timestamptz DEFAULT now(),
    local_path text
);

-- Index pour améliorer les performances
CREATE INDEX idx_harvest_results_data_source_id ON public.harvest_results(data_source_id);
CREATE INDEX idx_harvest_results_harvested_at ON public.harvest_results(harvested_at);
CREATE INDEX idx_harvest_results_status ON public.harvest_results(status);

-- RLS et politiques
ALTER TABLE public.harvest_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to harvest_results"
    ON public.harvest_results
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- TABLE: harvest_logs
-- =====================================================
CREATE TABLE public.harvest_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid REFERENCES public.data_sources(id) ON DELETE CASCADE,
    level text DEFAULT 'info' NOT NULL,
    message text NOT NULL,
    details jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX idx_harvest_logs_data_source_id ON public.harvest_logs(data_source_id);
CREATE INDEX idx_harvest_logs_level ON public.harvest_logs(level);
CREATE INDEX idx_harvest_logs_created_at ON public.harvest_logs(created_at);

-- RLS et politiques
ALTER TABLE public.harvest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to harvest_logs"
    ON public.harvest_logs
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- DONNÉES DE TEST (optionnel)
-- =====================================================

-- Insérer quelques données de test pour vérifier le bon fonctionnement
INSERT INTO public.data_sources (name, url, type, status, description) VALUES
    ('Site Test', 'https://example.com', 'web', 'active', 'Site de test pour validation du système'),
    ('API Test', 'https://api.example.com', 'api', 'inactive', 'API de test pour les données JSON');

-- Insérer une configuration de test
INSERT INTO public.harvesting_configs (data_source_id, frequency, selectors, filters, max_pages, delay_between_requests)
SELECT 
    id,
    'daily',
    '{"documentFormats": ["pdf", "docx"], "languages": ["FR"], "titleSelector": "h1", "contentSelector": ".content"}'::jsonb,
    '{"keywords": "test", "excludeKeywords": "draft"}'::jsonb,
    10,
    1000
FROM public.data_sources 
WHERE name = 'Site Test'
LIMIT 1;

-- Insérer un log de test avec un cast correct pour jsonb
INSERT INTO public.harvest_logs (data_source_id, level, message, details)
SELECT 
    id,
    'info',
    'Système MissanIa-Moisson V3 initialisé avec succès',
    ('{"version": "3.0", "timestamp": "' || now()::text || '"}')::jsonb
FROM public.data_sources 
WHERE name = 'Site Test'
LIMIT 1;

-- =====================================================
-- VÉRIFICATIONS FINALES
-- =====================================================

-- Vérifier que toutes les tables ont été créées
DO $$
DECLARE
    table_count integer;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('data_sources', 'harvesting_configs', 'harvest_results', 'harvest_logs');
    
    IF table_count = 4 THEN
        RAISE NOTICE '✅ SUCCÈS: Toutes les tables MissanIa-Moisson V3 ont été créées (% tables)', table_count;
    ELSE
        RAISE EXCEPTION '❌ ERREUR: Seulement % tables créées sur 4 attendues', table_count;
    END IF;
END $$;

-- Afficher un résumé des tables créées
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('data_sources', 'harvesting_configs', 'harvest_results', 'harvest_logs')
ORDER BY tablename;