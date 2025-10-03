import React, { useState } from 'react';
import { Plus, Globe, Settings, Trash2, Edit, AlertCircle, CheckCircle, Clock, Play, Square } from 'lucide-react';
import { useDataSources } from '../hooks/useDataSources';
import { useHarvestingConfigs } from '../hooks/useHarvestingConfigs';
import { isSupabaseConfigured } from '../lib/supabase';
import DataSourceForm from './DataSourceForm';
import HarvestingConfigForm from './HarvestingConfigForm';

const DataSourceManager: React.FC = () => {
  const { dataSources, loading, error, createDataSource, updateDataSource, deleteDataSource } = useDataSources();
  const { configs, createConfig, updateConfig, getConfigByDataSource } = useHarvestingConfigs();
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [configuringSource, setConfiguringSource] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  
  // Vérifier si Supabase est configuré
  if (!isSupabaseConfigured()) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <Globe className="h-12 w-12 text-blue-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-blue-900 mb-2">Configuration Supabase requise</h3>
        <p className="text-blue-700 mb-4">
          Pour utiliser le système de moissonnage, vous devez d'abord configurer Supabase.
        </p>
        <p className="text-sm text-blue-600">
          Cliquez sur le bouton "Connect to Supabase" en haut à droite pour commencer.
        </p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateSource = async (sourceData: any) => {
    try {
      await createDataSource(sourceData);
      setShowForm(false);
    } catch (err) {
      console.error('Erreur lors de la création:', err);
    }
  };

  const handleUpdateSource = async (id: string, updates: any) => {
    try {
      await updateDataSource(id, updates);
      setEditingSource(null);
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette source de données ?')) {
      try {
        await deleteDataSource(id);
        setSelectedSources(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (err) {
        console.error('Erreur lors de la suppression:', err);
      }
    }
  };

  const handleSelectSource = (id: string) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedSources.size === dataSources.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(dataSources.map(s => s.id)));
    }
  };

  const handleStartHarvesting = () => {
    if (selectedSources.size === 0) {
      alert('Veuillez sélectionner au moins une source pour démarrer le moissonnage.');
      return;
    }
    
    // TODO: Implémenter le démarrage du moissonnage
    console.log('Démarrage du moissonnage pour:', Array.from(selectedSources));
    alert(`Moissonnage démarré pour ${selectedSources.size} source(s)`);
  };

  const handleConfigureSource = (sourceId: string) => {
    setConfiguringSource(sourceId);
  };

  const handleSaveConfig = async (configData: any) => {
    try {
      const existingConfig = getConfigByDataSource(configData.data_source_id);
      if (existingConfig) {
        await updateConfig(existingConfig.id, configData);
      } else {
        await createConfig(configData);
      }
      setConfiguringSource(null);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde de la configuration:', err);
    }
  };

  const getNextHarvestDate = (source: any) => {
    const config = getConfigByDataSource(source.id);
    if (!config || config.frequency === 'manual') {
      return 'Manuel';
    }
    
    // TODO: Calculer la prochaine date basée sur la fréquence
    const now = new Date();
    switch (config.frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toLocaleDateString('fr-FR');
      default:
        return 'Non planifié';
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Chargement des sources de données...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">Erreur: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sources de Données</h2>
          <p className="text-gray-600 mt-1">
            Gérez vos sources de données et configurez le moissonnage
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedSources.size > 0 && (
            <button
              onClick={handleStartHarvesting}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Play className="h-4 w-4" />
              <span>Lancer le moissonnage ({selectedSources.size})</span>
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter une source</span>
          </button>
        </div>
      </div>

      {/* Tableau des sources */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {dataSources.length === 0 ? (
          <div className="p-8 text-center">
            <Globe className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune source configurée</h3>
            <p className="text-gray-500 mb-4">
              Commencez par ajouter votre première source de données à moissonner.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Ajouter une source</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedSources.size === dataSources.length && dataSources.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dernier moissonnage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prochain moissonnage
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dataSources.map((source) => (
                  <tr key={source.id} className={`hover:bg-gray-50 transition-colors ${
                    selectedSources.has(source.id) ? 'bg-blue-50' : ''
                  }`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedSources.has(source.id)}
                        onChange={() => handleSelectSource(source.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Globe className="h-4 w-4 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{source.name}</div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">{source.url}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {source.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(source.status)}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(source.status)}`}>
                          {source.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {/* TODO: Récupérer la date du dernier moissonnage */}
                      <span className="text-gray-400">Jamais</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={getConfigByDataSource(source.id) ? 'text-gray-900' : 'text-gray-400'}>
                        {getNextHarvestDate(source)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setEditingSource(source.id)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleConfigureSource(source.id)}
                          className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors"
                          title="Configurer"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSource(source.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulaire d'ajout/modification */}
      {(showForm || editingSource) && (
        <DataSourceForm
          source={editingSource ? dataSources.find(s => s.id === editingSource) : undefined}
          onSubmit={editingSource ? 
            (data) => handleUpdateSource(editingSource, data) : 
            handleCreateSource
          }
          onCancel={() => {
            setShowForm(false);
            setEditingSource(null);
          }}
        />
      )}

      {/* Formulaire de configuration du moissonnage */}
      {configuringSource && (
        <HarvestingConfigForm
          dataSource={dataSources.find(s => s.id === configuringSource)!}
          config={getConfigByDataSource(configuringSource)}
          onSubmit={handleSaveConfig}
          onCancel={() => setConfiguringSource(null)}
        />
      )}
    </div>
  );
};

export default DataSourceManager;