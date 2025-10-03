import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type DataSource = Database['public']['Tables']['data_sources']['Row'];
type DataSourceInsert = Database['public']['Tables']['data_sources']['Insert'];
type DataSourceUpdate = Database['public']['Tables']['data_sources']['Update'];

export class DataSourceService {
  // Récupérer toutes les sources de données
  static async getAllDataSources(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
  }): Promise<DataSource[]> {
    if (!supabase) {
      throw new Error('Supabase n\'est pas configuré. Cliquez sur "Connect to Supabase" en haut à droite.');
    }
    
    try {
      console.log('🔄 Chargement des sources de données avec options:', options);
      
      let query = supabase
        .from('data_sources')
        .select('*');
      
      // Appliquer les filtres si fournis
      if (options?.search) {
        query = query.or(`name.ilike.%${options.search}%,url.ilike.%${options.search}%`);
      }
      
      if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }
      
      // Appliquer la pagination si fournie
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }
      
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;

    if (error) {
      throw new Error(`Erreur lors de la récupération des sources: ${error.message}`);
    }

    return data || [];
    } catch (networkError) {
      console.error('❌ Erreur réseau getAllDataSources:', networkError);
      if (networkError instanceof TypeError && networkError.message.includes('fetch')) {
        throw new Error('Impossible de se connecter à Supabase. Vérifiez votre configuration.');
      }
      throw networkError;
    }
  }

  // Compter le nombre total de sources (pour la pagination)
  static async getDataSourcesCount(options?: {
    search?: string;
    status?: string;
  }): Promise<number> {
    if (!supabase) {
      throw new Error('Supabase n\'est pas configuré');
    }
    
    try {
      let query = supabase
        .from('data_sources')
        .select('*', { count: 'exact', head: true });
      
      // Appliquer les mêmes filtres que getAllDataSources
      if (options?.search) {
        query = query.or(`name.ilike.%${options.search}%,url.ilike.%${options.search}%`);
      }
      
      if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }
      
      const { count, error } = await query;
      
      if (error) {
        console.error('❌ Erreur lors du comptage:', error);
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      console.error('❌ Erreur réseau getDataSourcesCount:', error);
      return 0;
    }
  }

  // Créer une nouvelle source de données
  static async createDataSource(dataSource: DataSourceInsert): Promise<DataSource> {
    if (!supabase) {
      throw new Error('Supabase n\'est pas configuré');
    }
    
    const { data, error } = await supabase
      .from('data_sources')
      .insert(dataSource)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la création de la source: ${error.message}`);
    }

    return data;
  }

  // Mettre à jour une source de données
  static async updateDataSource(id: string, updates: DataSourceUpdate): Promise<DataSource> {
    if (!supabase) {
      throw new Error('Supabase n\'est pas configuré. Cliquez sur "Connect to Supabase" en haut à droite.');
    }
    
    console.log('🔄 Tentative mise à jour DataSource:', { id, updates });
    
    try {
    const { data, error } = await supabase
      .from('data_sources')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
        console.error('❌ Erreur Supabase updateDataSource:', error);
      throw new Error(`Erreur lors de la mise à jour de la source: ${error.message}`);
    }

      console.log('✅ DataSource mis à jour avec succès:', data.id);
    return data;
    } catch (networkError) {
      console.error('❌ Erreur réseau updateDataSource:', networkError);
      if (networkError instanceof TypeError && networkError.message.includes('fetch')) {
        throw new Error('Impossible de se connecter à Supabase. Vérifiez votre configuration.');
      }
      throw networkError;
    }
  }

  // Supprimer une source de données
  static async deleteDataSource(id: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase n\'est pas configuré');
    }
    
    const { error } = await supabase
      .from('data_sources')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erreur lors de la suppression de la source: ${error.message}`);
    }
  }

  // Récupérer une source par ID
  static async getDataSourceById(id: string): Promise<DataSource | null> {
    if (!supabase) {
      throw new Error('Supabase n\'est pas configuré');
    }
    
    try {
    const { data, error } = await supabase
      .from('data_sources')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.error('❌ Erreur Supabase getAllDataSources:', error);
        return null; // Aucun résultat trouvé
      }
      throw new Error(`Erreur lors de la récupération de la source: ${error.message}`);
    }

    return data;
    } catch (networkError) {
      console.error('❌ Erreur réseau getAllDataSources:', networkError);
      if (networkError instanceof TypeError && networkError.message.includes('fetch')) {
        throw new Error('Impossible de se connecter à Supabase. Vérifiez votre configuration.');
      }
      throw networkError;
    }
  }

  // Récupérer les sources par statut
  static async getDataSourcesByStatus(status: string): Promise<DataSource[]> {
    if (!supabase) {
      throw new Error('Supabase n\'est pas configuré. Cliquez sur "Connect to Supabase" en haut à droite.');
    }
    
    try {
    const { data, error } = await supabase
      .from('data_sources')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Erreur Supabase createDataSource:', error);
      throw new Error(`Erreur lors de la récupération des sources par statut: ${error.message}`);
    }

    return data || [];
    } catch (networkError) {
      console.error('❌ Erreur réseau createDataSource:', networkError);
      if (networkError instanceof TypeError && networkError.message.includes('fetch')) {
        throw new Error('Impossible de se connecter à Supabase. Vérifiez votre configuration.');
      }
      throw networkError;
    }
  }
}