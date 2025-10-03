import React, { useState, useEffect } from 'react';
import { X, Eye, Download, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { HarvestResultService } from '../services/harvestResultService';
import { HarvestDataImporter } from '../services/harvestDataImporter';
import type { Database } from '../lib/database.types';

type HarvestResult = Database['public']['Tables']['harvest_results']['Row'];
type DataSource = Database['public']['Tables']['data_sources']['Row'];

interface ImportProgress {
  phase: 'parsing' | 'documents' | 'site_update' | 'logs' | 'completed' | 'error';
  message: string;
  progress: number;
  documentsProcessed: number;
  totalDocuments: number;
  errors: string[];
  warnings: string[];
}

interface ViewHarvestResultsModalProps {
  isOpen: boolean;
  websiteId: string;
  websiteName: string;
  dataSource: DataSource;
  onClose: () => void;
  onImportData?: (harvestResult: HarvestResult) => void;
}

const ViewHarvestResultsModal: React.FC<ViewHarvestResultsModalProps> = ({
  isOpen,
  websiteId,
  websiteName,
  dataSource,
  onClose,
  onImportData
}) => {
  const [harvestResult, setHarvestResult] = useState<HarvestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [jsonView, setJsonView] = useState<'formatted' | 'raw'>('formatted');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [alreadyImported, setAlreadyImported] = useState(false);

  useEffect(() => {
    if (isOpen && websiteId) {
      loadHarvestResult();
    }
  }, [isOpen, websiteId]);

  const loadHarvestResult = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔍 Chargement du dernier résultat pour:', websiteId);
      const result = await HarvestResultService.getLatestResultByDataSource(websiteId);
      
      if (!result) {
        setError('Aucun résultat de moissonnage trouvé pour ce site.');
        setHarvestResult(null);
      } else {
        console.log('✅ Résultat chargé:', result.id);
        setHarvestResult(result);
        
        // Vérifier si les données ont déjà été importées
        const imported = await HarvestDataImporter.checkIfAlreadyImported(result.id);
        setAlreadyImported(imported);
      }
    } catch (err) {
      console.error('❌ Erreur chargement résultat:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      setHarvestResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadJson = () => {
    if (!harvestResult) return;
    
    const jsonData = JSON.stringify(harvestResult.data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `harvest_${websiteName}_${new Date(harvestResult.harvested_at).toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = () => {
    if (harvestResult) {
      startImportProcess();
    }
  };

  const startImportProcess = async () => {
    if (!harvestResult) return;
    
    setImporting(true);
    setImportProgress(null);
    setImportResult(null);
    
    // Configurer le callback de progression
    HarvestDataImporter.setProgressCallback((progress) => {
      setImportProgress(progress);
    });
    
    try {
      console.log('🚀 Début import des données pour:', harvestResult.id);
      
      const result = await HarvestDataImporter.importHarvestData(harvestResult, dataSource);
      
      setImportResult(result);
      
      if (result.success) {
        setAlreadyImported(true);
        // Appeler le callback parent si fourni
        if (onImportData) {
          onImportData(harvestResult);
        }
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'import:', error);
      setImportResult({
        success: false,
        errors: [error instanceof Error ? error.message : 'Erreur inconnue'],
        warnings: []
      });
    } finally {
      setImporting(false);
    }
  };

  const formatJsonForDisplay = (data: any) => {
    if (jsonView === 'raw') {
      return JSON.stringify(data, null, 2);
    }
    
    // Vue formatée avec structure lisible
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return 'Erreur lors du formatage JSON';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-orange-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Eye className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Résultats du Moissonnage
              </h3>
              <p className="text-sm text-gray-500">{websiteName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-gray-600">Chargement des résultats...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-orange-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun résultat disponible</h3>
              <p className="text-gray-500 mb-4">{error}</p>
              <p className="text-sm text-gray-400">
                Lancez d'abord un moissonnage pour ce site pour voir les résultats.
              </p>
            </div>
          ) : harvestResult ? (
            <div className="p-6 space-y-6">
              {/* Informations sur le moissonnage */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-gray-600" />
                  Informations du Moissonnage
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Statut :</span>
                    <div className="flex items-center space-x-2 mt-1">
                      {getStatusIcon(harvestResult.status)}
                      <span className="font-medium capitalize">{harvestResult.status}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Date :</span>
                    <div className="font-medium mt-1">
                      {new Date(harvestResult.harvested_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Heure :</span>
                    <div className="font-medium mt-1">
                      {new Date(harvestResult.harvested_at).toLocaleTimeString('fr-FR')}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">ID :</span>
                    <div className="font-mono text-xs mt-1 text-gray-500">
                      {harvestResult.id.substring(0, 8)}...
                    </div>
                  </div>
                </div>
                
                {harvestResult.error_message && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 text-red-800">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Erreur :</span>
                    </div>
                    <p className="text-red-700 text-sm mt-1">{harvestResult.error_message}</p>
                  </div>
                )}
              </div>

              {/* Contrôles d'affichage */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-700">Affichage :</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setJsonView('formatted')}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        jsonView === 'formatted' 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Formaté
                    </button>
                    <button
                      onClick={() => setJsonView('raw')}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        jsonView === 'raw' 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Brut
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleDownloadJson}
                    className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Télécharger</span>
                  </button>
                  
                  {onImportData && (
                    <button
                      onClick={handleImportData}
                      disabled={importing || alreadyImported}
                      className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                        alreadyImported 
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : importing
                          ? 'bg-blue-400 text-white cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                      title={alreadyImported ? 'Données déjà importées' : 'Importer les données dans les tables'}
                    >
                      {importing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Import en cours...</span>
                        </>
                      ) : alreadyImported ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          <span>Déjà importé</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" />
                          <span>Importer les données</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Progression d'import */}
              {importing && importProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-md font-medium text-blue-900 mb-3 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Import en cours
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm text-blue-700 mb-1">
                        <span>{importProgress.message}</span>
                        <span>{Math.round(importProgress.progress)}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${importProgress.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {importProgress.totalDocuments > 0 && (
                      <div className="text-sm text-blue-600">
                        Documents traités: {importProgress.documentsProcessed} / {importProgress.totalDocuments}
                      </div>
                    )}
                    
                    {importProgress.warnings.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded p-2">
                        <div className="text-sm text-orange-800 font-medium mb-1">Avertissements:</div>
                        <ul className="text-xs text-orange-700 space-y-1 max-h-20 overflow-y-auto">
                          {importProgress.warnings.slice(-3).map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Résultats d'import */}
              {importResult && !importing && (
                <div className={`border rounded-lg p-4 ${
                  importResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center mb-3">
                    {importResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                    )}
                    <span className={`font-medium ${
                      importResult.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {importResult.success ? 'Import réussi' : 'Import échoué'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-600">Documents importés:</span>
                      <span className="ml-2 font-medium text-green-600">{importResult.documentsImported || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Logs importés:</span>
                      <span className="ml-2 font-medium text-blue-600">{importResult.logsImported || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Obstacles mis à jour:</span>
                      <span className="ml-2 font-medium">{importResult.obstaclesUpdated ? '✅' : '❌'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Recommandations mises à jour:</span>
                      <span className="ml-2 font-medium">{importResult.recommandationsUpdated ? '✅' : '❌'}</span>
                    </div>
                  </div>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="bg-white rounded p-3 border border-red-100">
                      <h5 className="text-sm font-medium text-red-800 mb-2">Erreurs:</h5>
                      <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                        {importResult.errors.map((error: string, index: number) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {importResult.warnings && importResult.warnings.length > 0 && (
                    <div className="bg-orange-50 rounded p-3 border border-orange-100 mt-2">
                      <h5 className="text-sm font-medium text-orange-800 mb-2">Avertissements:</h5>
                      <ul className="text-sm text-orange-700 space-y-1 max-h-32 overflow-y-auto">
                        {importResult.warnings.map((warning: string, index: number) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {/* Contenu JSON */}
              <div className="bg-gray-900 rounded-lg p-4 overflow-auto">
                <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap break-words">
                  {formatJsonForDisplay(harvestResult.data)}
                </pre>
              </div>

              {/* Métadonnées */}
              {harvestResult.metadata && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-md font-medium text-blue-900 mb-3">Métadonnées</h4>
                  <pre className="text-blue-800 text-sm font-mono whitespace-pre-wrap">
                    {JSON.stringify(harvestResult.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewHarvestResultsModal;