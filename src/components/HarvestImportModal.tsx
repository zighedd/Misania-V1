import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle, Download, Folder } from 'lucide-react';
import { HarvestImportService } from '../services/harvestImportService';
import { JsonImportValidator } from '../services/jsonImportValidator';
import type { Database } from '../lib/database.types';

type DataSource = Database['public']['Tables']['data_sources']['Row'];
type HarvestingConfig = Database['public']['Tables']['harvesting_configs']['Row'];

interface ImportProgress {
  phase: 'validation' | 'directory' | 'downloading' | 'saving' | 'completed' | 'error';
  message: string;
  progress: number;
  documentsProcessed: number;
  totalDocuments: number;
  errors: string[];
  warnings: string[];
}

interface HarvestImportModalProps {
  isOpen: boolean;
  dataSource: DataSource;
  config?: HarvestingConfig;
  onClose: () => void;
  onSuccess: () => void;
}

const HarvestImportModal: React.FC<HarvestImportModalProps> = ({
  isOpen,
  dataSource,
  config,
  onClose,
  onSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonContent, setJsonContent] = useState<string>('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      alert('Veuillez sélectionner un fichier JSON');
      return;
    }

    setSelectedFile(file);
    setValidationResult(null);
    setImportResult(null);

    // Lire le contenu du fichier
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonContent(content);
      
      // Valider immédiatement
      const validation = JsonImportValidator.validateImportJson(content);
      setValidationResult(validation);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!selectedFile || !jsonContent || !validationResult?.isValid) {
      return;
    }

    setImporting(true);
    setImportProgress(null);
    setImportResult(null);

    // Configurer le callback de progression
    HarvestImportService.setProgressCallback((progress) => {
      setImportProgress(progress);
    });

    try {
      const result = await HarvestImportService.importHarvestResults(
        jsonContent,
        dataSource,
        config
      );

      setImportResult(result);
      
      if (result.success) {
        // Attendre 2 secondes pour que l'utilisateur voie le résultat
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Erreur lors de l\'importation:', error);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setJsonContent('');
    setValidationResult(null);
    setImporting(false);
    setImportProgress(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'validation':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'directory':
        return <Folder className="h-5 w-5 text-purple-600" />;
      case 'downloading':
        return <Download className="h-5 w-5 text-orange-600" />;
      case 'saving':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Upload className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Importer résultats de moissonnage
              </h3>
              <p className="text-sm text-gray-500">{dataSource.name}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={importing}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Sélection de fichier */}
          {!importing && !importResult && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fichier JSON de moissonnage
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center space-y-2"
                >
                  <Upload className="h-8 w-8 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {selectedFile ? selectedFile.name : 'Cliquez pour sélectionner un fichier JSON'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Résultats de validation */}
          {validationResult && !importing && !importResult && (
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Validation du fichier</h4>
              
              {/* Résumé de validation */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="text-sm font-medium text-blue-800 mb-2">📊 Résumé de l'analyse :</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Documents détectés :</span>
                    <span className="ml-2 font-medium">{validationResult.summary?.totalDocuments || 0}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Documents valides :</span>
                    <span className="ml-2 font-medium text-green-600">{validationResult.summary?.validDocuments || 0}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Logs détectés :</span>
                    <span className="ml-2 font-medium">{validationResult.summary?.totalLogs || 0}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Logs valides :</span>
                    <span className="ml-2 font-medium text-green-600">{validationResult.summary?.validLogs || 0}</span>
                  </div>
                </div>
              </div>

              {validationResult.isValid ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-green-700 font-medium">Fichier JSON valide</span>
                  </div>
                  <div className="mt-2 text-sm text-green-600">
                    ✅ Prêt pour l'importation : {validationResult.summary?.validDocuments || 0} document(s) seront traités
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                    <span className="text-red-700 font-medium">
                      {validationResult.errors.length} erreur(s) critique(s) détectée(s)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {validationResult.errors.map((error: any, index: number) => (
                      <div key={index} className="bg-white rounded p-3 border border-red-100">
                        <div className="text-sm text-red-800 font-medium mb-1">
                          {error.documentIndex !== undefined && `📄 Document ${error.documentIndex + 1}: `}
                          {error.logIndex !== undefined && `📝 Log ${error.logIndex + 1}: `}
                          {error.message}
                        </div>
                        {error.context && (
                          <div className="text-xs text-red-600 mb-2 bg-red-25 p-1 rounded">
                            📍 Contexte : {error.context}
                          </div>
                        )}
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded font-mono">
                          💡 {error.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avertissements */}
              {validationResult.warnings && validationResult.warnings.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                    <span className="text-orange-700 font-medium">
                      {validationResult.warnings.length} avertissement(s) détecté(s)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {validationResult.warnings.map((warning: any, index: number) => (
                      <div key={index} className="bg-white rounded p-3 border border-orange-100">
                        <div className="text-sm text-orange-800 font-medium mb-1">
                          {warning.documentIndex !== undefined && `📄 Document ${warning.documentIndex + 1}: `}
                          {warning.logIndex !== undefined && `📝 Log ${warning.logIndex + 1}: `}
                          {warning.message}
                        </div>
                        {warning.context && (
                          <div className="text-xs text-orange-600 mb-2 bg-orange-25 p-1 rounded">
                            📍 Contexte : {warning.context}
                          </div>
                        )}
                        <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded font-mono">
                          💡 {warning.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-orange-700 bg-orange-25 p-2 rounded">
                    ℹ️ Les avertissements n'empêchent pas l'importation, mais peuvent affecter la qualité des métadonnées.
                  </div>
                </div>
              )}

              {/* Suggestions d'amélioration */}
            </div>
          )}

          {/* Progression d'importation */}
          {importing && importProgress && (
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Importation en cours</h4>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  {getPhaseIcon(importProgress.phase)}
                  <span className="ml-2 text-blue-700 font-medium">{importProgress.message}</span>
                </div>
                
                <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress.progress}%` }}
                  ></div>
                </div>
                
                <div className="text-sm text-blue-600 space-y-1">
                  <div>
                  {importProgress.documentsProcessed} / {importProgress.totalDocuments} documents traités
                  </div>
                  <div className="text-xs text-blue-500">
                    Phase: {importProgress.phase} • {Math.round(importProgress.progress)}% terminé
                  </div>
                </div>
              </div>

              {/* Avertissements en temps réel */}
              {importProgress.warnings.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-orange-800 mb-2">⚠️ Avertissements :</h5>
                  <ul className="text-sm text-orange-700 space-y-1 max-h-32 overflow-y-auto">
                    {importProgress.warnings.slice(-5).map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                  {importProgress.warnings.length > 5 && (
                    <div className="text-xs text-orange-600 mt-2">
                      ... et {importProgress.warnings.length - 5} autres avertissements
                    </div>
                  )}
                </div>
              )}

              {/* Erreurs critiques en temps réel */}
              {importProgress.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-red-800 mb-2">🚨 Erreurs critiques :</h5>
                  <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                    {importProgress.errors.slice(-5).map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                  {importProgress.errors.length > 5 && (
                    <div className="text-xs text-red-600 mt-2">
                      ... et {importProgress.errors.length - 5} autres erreurs
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Résultats d'importation */}
          {importResult && !importing && (
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Résultats d'importation</h4>
              
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
                    {importResult.success ? 'Importation réussie' : 'Importation échouée'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Documents importés :</span>
                    <span className="ml-2 font-medium text-green-600">{importResult.documentsImported}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Échecs de téléchargement :</span>
                    <span className="ml-2 font-medium text-orange-600">{importResult.documentsWithErrors}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Logs importés :</span>
                    <span className="ml-2 font-medium text-blue-600">{importResult.logsImported}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Répertoire local :</span>
                    <span className="ml-2 font-mono text-xs text-gray-800">{importResult.localPath}</span>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mt-4 bg-white rounded p-3 border border-red-100">
                    <h5 className="text-sm font-medium text-red-800 mb-2">Erreurs :</h5>
                    <ul className="text-sm text-red-700 space-y-1">
                      {importResult.errors.map((error: string, index: number) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex justify-end space-x-3">
            {!importing && !importResult && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleImport}
                  disabled={!validationResult?.isValid}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  <span>Lancer l'importation</span>
                </button>
              </>
            )}
            
            {importing && (
              <button
                disabled
                className="bg-gray-400 text-white px-6 py-2 rounded-lg flex items-center space-x-2"
              >
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Importation en cours...</span>
              </button>
            )}

            {importResult && !importing && (
              <button
                onClick={handleClose}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HarvestImportModal;
