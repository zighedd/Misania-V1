import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type HarvestingConfig = Database['public']['Tables']['harvesting_configs']['Row'];
type HarvestingConfigInsert = Database['public']['Tables']['harvesting_configs']['Insert'];
type HarvestingConfigUpdate = Database['public']['Tables']['harvesting_configs']['Update'];

export class HarvestingConfigService {
  // Récupérer toutes les configurations
  static async getAllConfigs(): Promise<HarvestingConfig[]> {
    const { data, error } = await supabase
      .from('harvesting_configs')
      .select(`
        *,
        data_sources (
          id,
          name,
          url,
          type,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur lors de la récupération des configurations: ${error.message}`);
    }

    return data || [];
  }

  // Récupérer les configurations pour une source spécifique
  static async getConfigsByDataSource(dataSourceId: string): Promise<HarvestingConfig[]> {
    const { data, error } = await supabase
      .from('harvesting_configs')
      .select('*')
      .eq('data_source_id', dataSourceId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur lors de la récupération des configurations: ${error.message}`);
    }

    return data || [];
  }

  // Créer une nouvelle configuration
  static async createConfig(config: HarvestingConfigInsert): Promise<HarvestingConfig> {
    const { data, error } = await supabase
      .from('harvesting_configs')
      .insert(config)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la création de la configuration: ${error.message}`);
    }

    return data;
  }

  // Mettre à jour une configuration
  static async updateConfig(id: string, updates: HarvestingConfigUpdate): Promise<HarvestingConfig> {
    const { data, error } = await supabase
      .from('harvesting_configs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la mise à jour de la configuration: ${error.message}`);
    }

    return data;
  }

  // Supprimer une configuration
  static async deleteConfig(id: string): Promise<void> {
    const { error } = await supabase
      .from('harvesting_configs')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erreur lors de la suppression de la configuration: ${error.message}`);
    }
  }
}