import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Filter, Globe, Play, Square, Trash2, AlertTriangle, ChevronDown, Clock, Upload } from 'lucide-react';
import { Eye } from 'lucide-react';
import { useDataSources } from '../hooks/useDataSources';
import { useHarvestingConfigs } from '../hooks/useHarvestingConfigs';
import { useDebounce } from '../hooks/useDebounce';
import { isSupabaseConfigured } from '../lib/supabase';
import { HarvestLogService } from '../services/harvestLogService';
import { OpenAIHarvestingService } from '../services/openAIHarvestingService';
import Pagination from './Pagination';

// Lazy loading des modales lourdes pour améliorer les performances
const WebsiteConfigForm = React.lazy(() => import('./WebsiteConfigForm'));
const ConfirmationModal = React.lazy(() => import('./ConfirmationModal'));
const AlertsModal = React.lazy(() => import('./AlertsModal'));
const DeleteConfirmationModal = React.lazy(() => import('./DeleteConfirmationModal'));
const DocumentsModal = React.lazy(() => import('./DocumentsModal'));
const HarvestImportModal = React.lazy(() => import('./HarvestImportModal'));
const ViewHarvestResultsModal = React.lazy(() => import('./ViewHarvestResultsModal'));

const WebsiteManager: React.FC = () => {
  const { dataSources, loading, error, createDataSource, updateDataSource, deleteDataSource } = useDataSources();
  const { configs, createConfig, updateConfig, getConfigByDataSource } = useHarvestingConfigs();

  // Charger les compteurs d'alertes pour tous les sites
  useEffect(() => {
    const loadAlertCounts = async () => {
      if (!isSupabaseConfigured() || dataSources.length === 0) return;
      
      try {
        const counts: Record<string, number> = {};
        await Promise.all(
          dataSources.map(async (source) => {
            try {
              const alertCount = await HarvestLogService.getAlertCountByDataSource(source.id);
              counts[source.id] = alertCount.error + alertCount.warning; // Compter seulement les erreurs et warnings
            } catch (err) {
              console.error(`Erreur lors du chargement des alertes pour ${source.name}:`, err);
              counts[source.id] = 0;
            }
          })
        );
        setAlertCounts(counts);
      } catch (err) {
        console.error('Erreur lors du chargement des compteurs d\'alertes:', err);
      }
    };

    loadAlertCounts();
  }, [dataSources]);

  const [showConfigForm, setShowConfigForm] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<string | null>(null);
  const [selectedWebsites, setSelectedWebsites] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Debounce de la recherche pour améliorer les performances
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  const [harvestingStates, setHarvestingStates] = useState<Record<string, boolean>>({});
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    websiteId: string;
    websiteName: string;
  }>({
    isOpen: false,
    websiteId: '',
    websiteName: ''
  });
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    websiteId: string;
    websiteName: string;
    websiteUrl: string;
  }>({
    isOpen: false,
    websiteId: '',
    websiteName: '',
    websiteUrl: ''
  });
  const [alertsModal, setAlertsModal] = useState<{
    isOpen: boolean;
    websiteId: string;
    websiteName: string;
  }>({
    isOpen: false,
    websiteId: '',
    websiteName: ''
  });
  const [documentsModal, setDocumentsModal] = useState<{
    isOpen: boolean;
    websiteId: string;
    websiteName: string;
    websiteUrl: string;
  }>({
    isOpen: false,
    websiteId: '',
    websiteName: '',
    websiteUrl: ''
  });
  const [alertCounts, setAlertCounts] = useState<Record<string, number>>({});
  const [importModal, setImportModal] = useState<{
    isOpen: boolean;
    websiteId: string;
    websiteName: string;
  }>({
    isOpen: false,
    websiteId: '',
    websiteName: ''
  });
  const [viewResultsModal, setViewResultsModal] = useState<{
    isOpen: boolean;
    websiteId: string;
    websiteName: string;
  }>({
    isOpen: false,
    websiteId: '',
    websiteName: ''
  });
  
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
        return <div className="w-3 h-3 bg-green-500 rounded-full"></div>;
      case 'inactive':
        return <div className="w-3 h-3 bg-gray-400 rounded-full"></div>;
      case 'suspended':
        return <div className="w-3 h-3 bg-orange-500 rounded-full"></div>;
      default:
        return <div className="w-3 h-3 bg-gray-400 rounded-full"></div>;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Actif';
      case 'inactive':
        return 'Inactif';
      case 'suspended':
        return 'Suspendu';
      default:
        return status;
    }
  };

  const handleConfigureWebsite = (websiteId?: string) => {
    if (websiteId) {
      setEditingWebsite(websiteId);
    } else {
      // Si aucun site spécifique n'est passé, utiliser le premier site sélectionné
      const selectedId = selectedWebsites.size === 1 ? Array.from(selectedWebsites)[0] : null;
      setEditingWebsite(selectedId);
    }
    setShowConfigForm(true);
  };

  const handleCreateOrUpdateWebsite = async (websiteData: any) => {
    try {
      const { siteData, configData } = websiteData;
      let websiteId: string;

      if (editingWebsite) {
        // Mettre à jour le site existant
        await updateDataSource(editingWebsite, siteData);
        websiteId = editingWebsite;
      } else {
        // Créer un nouveau site
        const newWebsite = await createDataSource(siteData);
        websiteId = newWebsite.id;
      }

      // Gérer la configuration de moissonnage
      const existingConfig = getConfigByDataSource(websiteId);
      const configWithDataSource = {
        ...configData,
        data_source_id: websiteId
      };

      if (existingConfig) {
        // Mettre à jour la configuration existante
        await updateConfig(existingConfig.id, configWithDataSource);
      } else {
        // Créer une nouvelle configuration
        await createConfig(configWithDataSource);
      }

      setShowConfigForm(false);
      setEditingWebsite(null);
    } catch (err) {
      console.error('Erreur lors de la configuration:', err);
    }
  };

  const handleDeleteWebsite = async (id: string) => {
    const website = dataSources.find(s => s.id === id);
    if (website) {
      setDeleteModal({
        isOpen: true,
        websiteId: id,
        websiteName: website.name,
        websiteUrl: website.url
      });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteDataSource(deleteModal.websiteId);
      setSelectedWebsites(prev => {
        const newSet = new Set(prev);
        newSet.delete(deleteModal.websiteId);
        return newSet;
      });
      setDeleteModal({ isOpen: false, websiteId: '', websiteName: '', websiteUrl: '' });
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, websiteId: '', websiteName: '', websiteUrl: '' });
  };

  const handleViewAlerts = (websiteId: string) => {
    const website = dataSources.find(s => s.id === websiteId);
    if (website) {
      setAlertsModal({
        isOpen: true,
        websiteId,
        websiteName: website.name
      });
    }
  };

  const handleCloseAlerts = () => {
    setAlertsModal({ isOpen: false, websiteId: '', websiteName: '' });
  };

  const handleSelectWebsite = (id: string) => {
    setSelectedWebsites(prev => {
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
    if (selectedWebsites.size === paginatedWebsites.length) {
      setSelectedWebsites(new Set());
    } else {
      setSelectedWebsites(new Set(paginatedWebsites.map(s => s.id)));
    }
  };

  const handleStartHarvesting = async () => {
    if (selectedWebsites.size === 0) return;
    
    try {
      console.log('Lancement du moissonnage pour les sites:', Array.from(selectedWebsites));
      
      // Mettre à jour l'état pour afficher les spinners
      const selectedIds = Array.from(selectedWebsites);
      selectedIds.forEach(websiteId => {
        setHarvestingStates(prev => ({ ...prev, [websiteId]: true }));
      });
      
      // Récupérer les sites sélectionnés
      const selectedSites = dataSources.filter(site => selectedWebsites.has(site.id));
      
      // Lancer le moissonnage OpenAI multiple
      const results = await OpenAIHarvestingService.harvestMultipleWebsites(selectedSites);
      
      // Arrêter les spinners pour tous les sites
      selectedIds.forEach(websiteId => {
        setHarvestingStates(prev => ({ ...prev, [websiteId]: false }));
      });
      
      // Log des résultats
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      console.log(`Moissonnage multiple terminé: ${successCount} succès, ${errorCount} échecs`);
      
    } catch (err) {
      console.error('Erreur lors du lancement du moissonnage multiple:', err);
      
      // Arrêter tous les spinners en cas d'erreur globale
      Array.from(selectedWebsites).forEach(websiteId => {
        setHarvestingStates(prev => ({ ...prev, [websiteId]: false }));
      });
      }
      
      // Désélectionner tous les sites après le lancement
      setSelectedWebsites(new Set());
  };

  const handleToggleHarvesting = async (websiteId: string, isRunning: boolean) => {
    if (isRunning) {
      // Ouvrir la modale de confirmation pour arrêter
      const website = dataSources.find(s => s.id === websiteId);
      setConfirmationModal({
        isOpen: true,
        websiteId,
        websiteName: website?.name || 'Site inconnu'
      });
      return;
    }

    // Démarrer le moissonnage directement (pas de confirmation nécessaire)
    await executeHarvestingToggle(websiteId, isRunning);
  };

  const executeHarvestingToggle = async (websiteId: string, isRunning: boolean) => {
    try {
      // Mettre à jour l'état local
      setHarvestingStates(prev => ({
        ...prev,
        [websiteId]: !isRunning
      }));

      if (!isRunning) {
        // Démarrer le moissonnage
        console.log('Démarrage du moissonnage pour:', websiteId);
        
        // Récupérer les données du site
        const website = dataSources.find(s => s.id === websiteId);
        if (!website) {
          throw new Error('Site non trouvé');
        }
        
        // Lancer le moissonnage OpenAI
        const result = await OpenAIHarvestingService.harvestWebsite(website);
        
        // Arrêter le spinner
        setHarvestingStates(prev => ({
          ...prev,
          [websiteId]: false
        }));
        
        if (result.success) {
          console.log('Moissonnage terminé avec succès pour:', websiteId);
        } else {
          console.error('Moissonnage échoué pour:', websiteId, result.error);
        }
        
      } else {
        // Arrêter le moissonnage
        console.log('Arrêt du moissonnage pour:', websiteId);
        // Note: L'arrêt forcé n'est pas implémenté pour OpenAI
        setHarvestingStates(prev => ({
          ...prev,
          [websiteId]: false
        }));
      }
    } catch (err) {
      console.error('Erreur lors du contrôle du moissonnage:', err);
      // Restaurer l'état précédent en cas d'erreur
      setHarvestingStates(prev => ({
        ...prev,
        [websiteId]: isRunning
      }));
    }
  };

  const handleConfirmStop = async () => {
    await executeHarvestingToggle(confirmationModal.websiteId, true);
    setConfirmationModal({ isOpen: false, websiteId: '', websiteName: '' });
  };

  const handleCancelStop = () => {
    setConfirmationModal({ isOpen: false, websiteId: '', websiteName: '' });
  };

  const handleViewDocuments = (websiteId: string) => {
    const website = dataSources.find(s => s.id === websiteId);
    if (website) {
      setDocumentsModal({
        isOpen: true,
        websiteId,
        websiteName: website.name,
        websiteUrl: website.url
      });
    }
  };

  const handleImportResults = (websiteId: string) => {
    const website = dataSources.find(s => s.id === websiteId);
    if (website) {
      setImportModal({
        isOpen: true,
        websiteId,
        websiteName: website.name
      });
    }
  };

  const handleCloseImport = () => {
    setImportModal({ isOpen: false, websiteId: '', websiteName: '' });
  };

  const handleViewResults = (websiteId: string) => {
    const website = dataSources.find(s => s.id === websiteId);
    if (website) {
      setViewResultsModal({
        isOpen: true,
        websiteId,
        websiteName: website.name
      });
    }
  };

  const handleCloseViewResults = () => {
    setViewResultsModal({ isOpen: false, websiteId: '', websiteName: '' });
  };

  const handleCloseDocuments = () => {
    setDocumentsModal({ 
      isOpen: false, 
      websiteId: '', 
      websiteName: '', 
      websiteUrl: '' 
    });
  };

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  // Filtrage et tri des sites
  const filteredWebsites = useMemo(() => {
    console.log('🔄 Recalcul des sites filtrés - Performance optimisée');
    
    return dataSources
      .filter(site => {
        const matchesSearch = site.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                             site.url.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || site.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let aValue, bValue;
      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'lastHarvest':
          // TODO: Utiliser vraies dates quand disponibles
          aValue = a.updated_at;
          bValue = b.updated_at;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [dataSources, debouncedSearchTerm, statusFilter, sortField, sortDirection]);

  // Pagination
  const paginationData = useMemo(() => {
    const totalItems = filteredWebsites.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedWebsites = filteredWebsites.slice(startIndex, endIndex);
    
    return { totalItems, totalPages, paginatedWebsites };
  }, [filteredWebsites, currentPage, itemsPerPage]);
  
  const { totalItems, totalPages, paginatedWebsites } = paginationData;

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setSelectedWebsites(new Set()); // Désélectionner lors du changement de page
  }, []);

  // Réinitialiser la page lors du changement de filtre
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter]);

  const getNextHarvestDate = (source: any) => {
    const config = getConfigByDataSource(source.id);
    if (!config || config.frequency === 'manual') {
      return 'Manuel';
    }
    
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

  const getAlertCount = (sourceId: string) => {
    return alertCounts[sourceId] || 0;
  };

  const isHarvestingRunning = (sourceId: string) => {
    return harvestingStates[sourceId] || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Chargement des sites web...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">Erreur: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion de Sites Web</h2>
          <p className="text-gray-600 mt-1">
            Configurez et gérez le moissonnage de vos sites web
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedWebsites.size > 0 && (
            <button
              onClick={handleStartHarvesting}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Play className="h-4 w-4" />
              <span>Lancer le moissonnage ({selectedWebsites.size})</span>
            </button>
          )}
          <button
            onClick={() => handleConfigureWebsite()}
            disabled={selectedWebsites.size > 1}
            className={`px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
              selectedWebsites.size > 1 
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                : 'bg-blue-800 hover:bg-blue-900 text-white'
            }`}
            title={selectedWebsites.size === 1 ? 'Modifier le site sélectionné' : 'Configurer un nouveau site'}
          >
            <span>
              {selectedWebsites.size === 1 ? 'Modifier le site' : 'Configurer un site'}
            </span>
          </button>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou URL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
                <option value="suspended">Suspendu</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Tableau des sites */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {filteredWebsites.length === 0 ? (
          <div className="p-8 text-center">
            <Globe className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun site configuré</h3>
            <p className="text-gray-500 mb-4">
              Commencez par configurer votre premier site web à moissonner.
            </p>
            <button
              onClick={() => handleConfigureWebsite()}
              className="bg-blue-800 hover:bg-blue-900 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors"
            >
              <span>Configurer un site</span>
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedWebsites.size === paginatedWebsites.length && paginatedWebsites.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Site Web</span>
                        {sortField === 'name' && (
                          <ChevronDown className={`h-3 w-3 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Statut</span>
                        {sortField === 'status' && (
                          <ChevronDown className={`h-3 w-3 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Alertes
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('lastHarvest')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Dernière collecte</span>
                        {sortField === 'lastHarvest' && (
                          <ChevronDown className={`h-3 w-3 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prochaine collecte
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedWebsites.map((website) => {
                    const alertCount = getAlertCount(website.id);
                    const isRunning = isHarvestingRunning(website.id);
                    
                    return (
                      <tr key={website.id} className={`hover:bg-gray-50 transition-colors ${
                        selectedWebsites.has(website.id) ? 'bg-blue-50' : ''
                      }`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedWebsites.has(website.id)}
                            onChange={() => handleSelectWebsite(website.id)}
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
                              <div className="text-sm font-medium text-gray-900">{website.name}</div>
                              <div className="text-sm text-gray-500 truncate max-w-xs">{website.url}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(website.status)}
                            <span className="text-sm text-gray-900">{getStatusText(website.status)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {alertCount > 0 ? (
                              <>
                                <div className="relative">
                                  <AlertTriangle className="h-5 w-5 text-red-500" />
                                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-medium">
                                    {alertCount}
                                  </span>
                                </div>
                                <button 
                                  onClick={() => handleViewAlerts(website.id)}
                                  className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 p-1 rounded transition-colors"
                                  title="Voir l'historique des incidents"
                                >
                                  <Clock className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-400 text-sm">Aucun</span>
                                <button 
                                  onClick={() => handleViewAlerts(website.id)}
                                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-1 rounded transition-colors"
                                  title="Voir l'historique des incidents"
                                >
                                  <Clock className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {/* TODO: Récupérer la vraie date du dernier moissonnage */}
                          <span className="text-gray-400">Jamais</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={getConfigByDataSource(website.id) ? 'text-gray-900' : 'text-gray-400'}>
                            {getNextHarvestDate(website)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleToggleHarvesting(website.id, isRunning)}
                              className={`p-2 rounded-lg transition-colors ${
                                isRunning 
                                  ? 'text-red-600 hover:text-red-800 hover:bg-red-50' 
                                  : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                              }`}
                              title={isRunning ? 'Arrêter le moissonnage' : 'Lancer le moissonnage'}
                            >
                              {isRunning ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleViewDocuments(website.id)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                              title="Voir les documents moissonnés"
                            >
                              <Globe className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleViewResults(website.id)}
                              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
                              title="Voir résultats JSON du moissonnage"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleImportResults(website.id)}
                              className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 p-2 rounded-lg transition-colors"
                              title="Importer résultats de moissonnage"
                            >
                              <Upload className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteWebsite(website.id)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              title="Supprimer le site"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              itemsPerPage={itemsPerPage}
              totalItems={totalItems}
            />
          </>
        )}
      </div>

      {/* Formulaire de configuration */}
      {showConfigForm && (
        <React.Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Chargement du formulaire...</p>
            </div>
          </div>
        }>
          <WebsiteConfigForm
            website={editingWebsite ? dataSources.find(s => s.id === editingWebsite) : undefined}
            config={editingWebsite ? getConfigByDataSource(editingWebsite) : undefined}
            onSubmit={handleCreateOrUpdateWebsite}
            onCancel={() => {
              setShowConfigForm(false);
              setEditingWebsite(null);
            }}
          />
        </React.Suspense>
      )}

      {/* Modale de confirmation d'arrêt */}
      {confirmationModal.isOpen && (
        <React.Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50" />}>
          <ConfirmationModal
            isOpen={confirmationModal.isOpen}
            title="Arrêter le moissonnage"
            message={`Voulez-vous arrêter le moissonnage en cours pour "${confirmationModal.websiteName}" ?\n\nCette action interrompra immédiatement la collecte de données pour ce site.`}
            confirmText="Arrêter"
            cancelText="Continuer"
            type="warning"
            onConfirm={handleConfirmStop}
            onCancel={handleCancelStop}
          />
        </React.Suspense>
      )}

      {/* Modale de confirmation de suppression */}
      {deleteModal.isOpen && (
        <React.Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50" />}>
          <DeleteConfirmationModal
            isOpen={deleteModal.isOpen}
            websiteName={deleteModal.websiteName}
            websiteUrl={deleteModal.websiteUrl}
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
          />
        </React.Suspense>
      )}

      {/* Modale des alertes */}
      {alertsModal.isOpen && (
        <React.Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50" />}>
          <AlertsModal
            isOpen={alertsModal.isOpen}
            websiteName={alertsModal.websiteName}
            websiteId={alertsModal.websiteId}
            onClose={handleCloseAlerts}
          />
        </React.Suspense>
      )}

      {/* Modale des documents */}
      {documentsModal.isOpen && (
        <React.Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50" />}>
          <DocumentsModal
            isOpen={documentsModal.isOpen}
            websiteName={documentsModal.websiteName}
            websiteUrl={documentsModal.websiteUrl}
            websiteId={documentsModal.websiteId}
            onClose={handleCloseDocuments}
          />
        </React.Suspense>
      )}

      {/* Modale d'importation */}
      {importModal.isOpen && (
        <React.Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50" />}>
          <HarvestImportModal
            isOpen={importModal.isOpen}
            dataSource={importModal.websiteId ? dataSources.find(s => s.id === importModal.websiteId)! : {} as any}
            config={importModal.websiteId ? getConfigByDataSource(importModal.websiteId) : undefined}
            onClose={handleCloseImport}
            onSuccess={() => {
              console.log('Importation réussie pour:', importModal.websiteName);
              // Optionnel: rafraîchir les données
            }}
          />
        </React.Suspense>
      )}

      {/* Modale de visualisation des résultats */}
      {viewResultsModal.isOpen && (
        <React.Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50" />}>
          <ViewHarvestResultsModal
            isOpen={viewResultsModal.isOpen}
            websiteId={viewResultsModal.websiteId}
            websiteName={viewResultsModal.websiteName}
            dataSource={viewResultsModal.websiteId ? dataSources.find(s => s.id === viewResultsModal.websiteId)! : {} as any}
            onClose={handleCloseViewResults}
            onImportData={(harvestResult) => {
              console.log('Import des données demandé pour:', harvestResult.id);
              // L'import est maintenant géré directement dans la modale
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export default WebsiteManager;