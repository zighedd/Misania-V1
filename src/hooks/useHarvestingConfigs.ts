import { useState, useEffect } from 'react';
import { HarvestingConfigService } from '../services/harvestingConfigService';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type HarvestingConfig = Database['public']['Tables']['harvesting_configs']['Row'];

export const useHarvestingConfigs = () => {
  const [configs, setConfigs] = useState<HarvestingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!isSupabaseConfigured()) {
        setError('Supabase n\'est pas configuré');
        return;
      }
      
      console.log('🔄 Chargement des configurations...');
      const configsData = await HarvestingConfigService.getAllConfigs();
      
      // Validation de sécurité
      if (!Array.isArray(configsData)) {
        console.error('❌ Configurations reçues ne sont pas un tableau:', typeof configsData);
        throw new Error('Format de données invalide reçu du serveur');
      }
      
      console.log('✅ Configurations chargées:', configsData.length);
      setConfigs(configsData);
    } catch (err) {
      console.error('❌ Erreur lors du chargement des configurations:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      
      // En cas d'erreur, s'assurer que l'état reste cohérent
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  const createConfig = async (configData: any) => {
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase n\'est pas configuré');
      }
      
      // Validation des données d'entrée
      if (!configData || !configData.data_source_id) {
        throw new Error('Configuration et data_source_id requis');
      }
      
      console.log('🔄 Création configuration pour:', configData.data_source_id);
      const newConfig = await HarvestingConfigService.createConfig(configData);
      
      // Validation de la réponse
      if (!newConfig || !newConfig.id) {
        throw new Error('Réponse invalide lors de la création de configuration');
      }
      
      console.log('✅ Configuration créée:', newConfig.id);
      setConfigs(prev => [newConfig, ...prev]);
      return newConfig;
    } catch (err) {
      console.error('❌ Erreur création configuration:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
      throw err;
    }
  };

  const updateConfig = async (id: string, updates: any) => {
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase n\'est pas configuré');
      }
      const updatedConfig = await HarvestingConfigService.updateConfig(id, updates);
      setConfigs(prev => 
        prev.map(config => config.id === id ? updatedConfig : config)
      );
      return updatedConfig;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
      throw err;
    }
  };

  const deleteConfig = async (id: string) => {
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase n\'est pas configuré');
      }
      await HarvestingConfigService.deleteConfig(id);
      setConfigs(prev => prev.filter(config => config.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      throw err;
    }
  };

  const getConfigByDataSource = (dataSourceId: string) => {
    return configs.find(config => config.data_source_id === dataSourceId);
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  return {
    configs,
    loading,
    error,
    refetch: fetchConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    getConfigByDataSource
  };
};