import { useState, useEffect } from 'react';
import { DataSourceService } from '../services/dataSourceService';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type DataSource = Database['public']['Tables']['data_sources']['Row'];

export const useDataSources = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchDataSources = async (options?: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!isSupabaseConfigured()) {
        setError('Supabase n\'est pas configuré. Veuillez cliquer sur "Connect to Supabase" en haut à droite.');
        return;
      }
      
      console.log('🔄 Chargement des sources de données avec options:', options);
      
      // Charger les données et le comptage en parallèle pour de meilleures performances
      const [sources, count] = await Promise.all([
        DataSourceService.getAllDataSources(options),
        options ? DataSourceService.getDataSourcesCount({
          search: options.search,
          status: options.status
        }) : Promise.resolve(0)
      ]);
      
      // Validation de sécurité
      if (!Array.isArray(sources)) {
        console.error('❌ Sources reçues ne sont pas un tableau:', typeof sources);
        throw new Error('Format de données invalide reçu du serveur');
      }
      
      console.log('✅ Sources chargées:', sources.length);
      setDataSources(sources);
      setTotalCount(count);
    } catch (err) {
      console.error('❌ Erreur lors du chargement des sources:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      
      // En cas d'erreur, s'assurer que l'état reste cohérent
      setDataSources([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const createDataSource = async (dataSource: Omit<DataSource, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase n\'est pas configuré');
      }
      
      // Validation des données d'entrée
      if (!dataSource.name || !dataSource.url) {
        throw new Error('Nom et URL sont requis pour créer une source');
      }
      
      console.log('🔄 Création source:', dataSource.name);
      const newSource = await DataSourceService.createDataSource(dataSource);
      
      // Validation de la réponse
      if (!newSource || !newSource.id) {
        throw new Error('Réponse invalide lors de la création');
      }
      
      console.log('✅ Source créée:', newSource.id);
      setDataSources(prev => [newSource, ...prev]);
      return newSource;
    } catch (err) {
      console.error('❌ Erreur création source:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
      throw err;
    }
  };

  const updateDataSource = async (id: string, updates: Partial<DataSource>) => {
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase n\'est pas configuré');
      }
      
      // Validation des paramètres
      if (!id || !updates) {
        throw new Error('ID et données de mise à jour requis');
      }
      
      console.log('🔄 Mise à jour source:', id);
      const updatedSource = await DataSourceService.updateDataSource(id, updates);
      
      // Validation de la réponse
      if (!updatedSource || updatedSource.id !== id) {
        throw new Error('Réponse invalide lors de la mise à jour');
      }
      
      console.log('✅ Source mise à jour:', id);
      setDataSources(prev => 
        prev.map(source => source.id === id ? updatedSource : source)
      );
      return updatedSource;
    } catch (err) {
      console.error('❌ Erreur mise à jour source:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
      throw err;
    }
  };

  const deleteDataSource = async (id: string) => {
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase n\'est pas configuré');
      }
      
      // Validation du paramètre
      if (!id) {
        throw new Error('ID requis pour la suppression');
      }
      
      console.log('🔄 Suppression source:', id);
      await DataSourceService.deleteDataSource(id);
      console.log('✅ Source supprimée:', id);
      setDataSources(prev => prev.filter(source => source.id !== id));
    } catch (err) {
      console.error('❌ Erreur suppression source:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      throw err;
    }
  };

  useEffect(() => {
    fetchDataSources();
  }, []);

  return {
    dataSources,
    loading,
    error,
    totalCount,
    refetch: fetchDataSources,
    createDataSource,
    updateDataSource,
    deleteDataSource
  };
};