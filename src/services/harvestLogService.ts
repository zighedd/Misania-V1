import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type HarvestLog = Database['public']['Tables']['harvest_logs']['Row'];
type HarvestLogInsert = Database['public']['Tables']['harvest_logs']['Insert'];

export class HarvestLogService {
  // Récupérer tous les logs
  static async getAllLogs(limit: number = 100): Promise<HarvestLog[]> {
    const { data, error } = await supabase
      .from('harvest_logs')
      .select(`
        *,
        data_sources (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erreur lors de la récupération des logs: ${error.message}`);
    }

    return data || [];
  }

  // Récupérer les logs par niveau
  static async getLogsByLevel(level: string, limit: number = 50): Promise<HarvestLog[]> {
    const { data, error } = await supabase
      .from('harvest_logs')
      .select('*')
      .eq('level', level)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erreur lors de la récupération des logs: ${error.message}`);
    }

    return data || [];
  }

  // Créer un nouveau log
  static async createLog(log: HarvestLogInsert): Promise<HarvestLog> {
    if (!supabase) {
      throw new Error('Supabase n\'est pas configuré');
    }
    
    const { data, error } = await supabase
      .from('harvest_logs')
      .insert(log)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la création du log: ${error.message}`);
    }

    return data;
  }

  // Méthodes utilitaires pour créer des logs
  static async logInfo(message: string, dataSourceId?: string, details?: any): Promise<void> {
    await this.createLog({
      level: 'info',
      message,
      data_source_id: dataSourceId,
      details: details || {}
    });
  }

  static async logWarning(message: string, dataSourceId?: string, details?: any): Promise<void> {
    await this.createLog({
      level: 'warning',
      message,
      data_source_id: dataSourceId,
      details: details || {}
    });
  }

  static async logError(message: string, dataSourceId?: string, details?: any): Promise<void> {
    await this.createLog({
      level: 'error',
      message,
      data_source_id: dataSourceId,
      details: details || {}
    });
  }

  // Récupérer les logs/alertes pour une source spécifique
  static async getLogsByDataSource(dataSourceId: string, limit: number = 50): Promise<HarvestLog[]> {
    const { data, error } = await supabase
      .from('harvest_logs')
      .select('*')
      .eq('data_source_id', dataSourceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erreur lors de la récupération des logs: ${error.message}`);
    }

    return data || [];
  }

  // Compter les alertes par niveau pour une source
  static async getAlertCountByDataSource(dataSourceId: string): Promise<{ total: number; error: number; warning: number; info: number }> {
    const { data, error } = await supabase
      .from('harvest_logs')
      .select('level')
      .eq('data_source_id', dataSourceId);

    if (error) {
      throw new Error(`Erreur lors du comptage des alertes: ${error.message}`);
    }

    const counts = { total: 0, error: 0, warning: 0, info: 0 };
    data?.forEach(log => {
      counts.total++;
      if (log.level === 'error') counts.error++;
      else if (log.level === 'warning') counts.warning++;
      else if (log.level === 'info') counts.info++;
    });

    return counts;
  }

  // Nettoyer les anciens logs
  static async cleanOldLogs(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('harvest_logs')
      .delete()
      .lt('created_at', cutoffDate);

    if (error) {
      throw new Error(`Erreur lors du nettoyage des logs: ${error.message}`);
    }
  }
}