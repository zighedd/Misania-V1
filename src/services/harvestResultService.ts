import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type HarvestResult = Database['public']['Tables']['harvest_results']['Row'];
type HarvestResultInsert = Database['public']['Tables']['harvest_results']['Insert'];

export class HarvestResultService {
  // Récupérer tous les résultats
  static async getAllResults(limit: number = 100): Promise<HarvestResult[]> {
    const { data, error } = await supabase
      .from('harvest_results')
      .select(`
        *,
        data_sources (
          id,
          name,
          url,
          type
        ),
        harvesting_configs (
          id,
          frequency
        )
      `)
      .order('harvested_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erreur lors de la récupération des résultats: ${error.message}`);
    }

    return data || [];
  }

  // Récupérer les résultats pour une source spécifique
  static async getResultsByDataSource(dataSourceId: string, limit: number = 50): Promise<HarvestResult[]> {
    const { data, error } = await supabase
      .from('harvest_results')
      .select('*')
      .eq('data_source_id', dataSourceId)
      .order('harvested_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erreur lors de la récupération des résultats: ${error.message}`);
    }

    return data || [];
  }

  // Récupérer le dernier résultat pour une source spécifique
  static async getLatestResultByDataSource(dataSourceId: string): Promise<HarvestResult | null> {
    const { data, error } = await supabase
      .from('harvest_results')
      .select('*')
      .eq('data_source_id', dataSourceId)
      .order('harvested_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Aucun résultat trouvé
      }
      throw new Error(`Erreur lors de la récupération du dernier résultat: ${error.message}`);
    }

    return data;
  }

  // Créer un nouveau résultat
  static async createResult(result: HarvestResultInsert): Promise<HarvestResult> {
    console.log('💾 HarvestResultService.createResult appelé');
    console.log('📋 Données à insérer:', JSON.stringify(result, null, 2));
    
    if (!supabase) {
      console.error('❌ Supabase non configuré');
      throw new Error('Supabase n\'est pas configuré');
    }
    
    console.log('🔄 Insertion en cours...');
    const { data, error } = await supabase
      .from('harvest_results')
      .insert(result)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur Supabase lors de l\'insertion:', error);
      console.error('- Code:', error.code);
      console.error('- Message:', error.message);
      console.error('- Details:', error.details);
      throw new Error(`Erreur lors de la création du résultat: ${error.message}`);
    }

    console.log('✅ Résultat créé avec succès, ID:', data.id);
    return data;
  }

  // Récupérer un résultat par ID (pour vérifier le cache d'analyse)
  static async getResultById(id: string): Promise<HarvestResult | null> {
    const { data, error } = await supabase
      .from('harvest_results')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Aucun résultat trouvé
      }
      throw new Error(`Erreur lors de la récupération du résultat: ${error.message}`);
    }

    return data;
  }

  // Mettre à jour un résultat (pour sauvegarder l'analyse)
  static async updateResult(id: string, updates: any): Promise<HarvestResult> {
    console.log('🔄 Mise à jour harvest_result:', id);
    
    const { data, error } = await supabase
      .from('harvest_results')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur mise à jour harvest_result:', error);
      throw new Error(`Erreur lors de la mise à jour: ${error.message}`);
    }

    console.log('✅ Harvest_result mis à jour avec succès');
    return data;
  }

  // Récupérer les documents pour une source spécifique
  static async getDocumentsByDataSource(dataSourceId: string, limit: number = 50): Promise<any[]> {
    const { data, error } = await supabase
      .from('harvest_results')
      .select('id, data, metadata, local_path, harvested_at, analysis_summary, analysis_keywords, analysis_completed_at')
      .eq('data_source_id', dataSourceId)
      .eq('status', 'success')
      .order('harvested_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erreur lors de la récupération des documents: ${error.message}`);
    }

    // Extraire et formater les documents
    const documents: any[] = [];
    data?.forEach(result => {
      const resultData = result.data as any;
      if (resultData && resultData.documents && Array.isArray(resultData.documents)) {
        resultData.documents.forEach((doc: any, index: number) => {
          documents.push({
            id: `${result.harvested_at}-${index}`, // ID composite pour l'affichage
            harvest_result_parent_id: result.id, // UUID réel pour les mises à jour
            ...doc,
            harvested_at: result.harvested_at,
            metadata: result.metadata,
            local_path: result.local_path,
            analysis_summary: result.analysis_summary,
            analysis_keywords: result.analysis_keywords,
            analysis_completed_at: result.analysis_completed_at
          });
        });
      }
    });

    return documents;
  }

  // Récupérer les statistiques des résultats
  static async getResultsStats() {
    const { data, error } = await supabase
      .from('harvest_results')
      .select('status, data_source_id, harvested_at')
      .gte('harvested_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      throw new Error(`Erreur lors de la récupération des statistiques: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      success: data?.filter(r => r.status === 'success').length || 0,
      error: data?.filter(r => r.status === 'error').length || 0,
      bySource: {} as Record<string, number>
    };

    data?.forEach(result => {
      stats.bySource[result.data_source_id] = (stats.bySource[result.data_source_id] || 0) + 1;
    });

    return stats;
  }
}