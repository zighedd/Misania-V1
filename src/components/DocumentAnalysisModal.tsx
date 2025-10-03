import React, { useState } from 'react';
import { X, Brain, FileText, Eye, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { DocumentAnalysisService } from '../services/documentAnalysisService';
import { ContentAnalysisService } from '../services/contentAnalysisService';

// Lazy loading de la modale de confirmation
const AnalysisConfirmationModal = React.lazy(() => import('./AnalysisConfirmationModal'));

interface AnalysisProgress {
  phase: 'download' | 'detection' | 'extraction' | 'ocr' | 'analysis' | 'completed';
  message: string;
  progress: number;
  currentPage?: number;
  totalPages?: number;
}

interface DocumentAnalysisModalProps {
  isOpen: boolean;
  docData: {
    id: string;
    harvest_result_parent_id?: string;
    url_doc: string;
    filename: string;
    document_name: string;
    local_path?: string;
  };
  onClose: () => void;
  onAnalysisComplete?: (analysis: any) => void;
}

const DocumentAnalysisModal: React.FC<DocumentAnalysisModalProps> = ({
  isOpen,
  docData,
  onClose,
  onAnalysisComplete
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [contentAnalysis, setContentAnalysis] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Méthodes utilitaires pour sauvegarder les nouvelles analyses
  const saveEmbeddingsToHarvestResult = async (harvestResultId: string, embeddingResult: any, contentAnalysis: any) => {
    try {
      // Récupérer les métadonnées existantes
      const existingResult = await HarvestResultService.getResultById(harvestResultId);
      const existingMetadata = existingResult?.metadata as any || {};
      
      // Ajouter les embeddings
      const updateData = {
        metadata: {
          ...existingMetadata,
          embedding: {
            embedding: embeddingResult.embedding,
            embedding_model: 'text-embedding-ada-002',
            text_hash: embeddingResult.contentHash,
            created_at: new Date().toISOString()
          }
        },
        analysis_summary: contentAnalysis.summary,
        analysis_keywords: contentAnalysis.keywords,
        analysis_completed_at: new Date().toISOString()
      };
      
      await HarvestResultService.updateResult(harvestResultId, updateData);
      console.log('✅ Embeddings sauvegardés dans harvest_result:', harvestResultId);
    } catch (error) {
      console.error('❌ Erreur sauvegarde embeddings:', error);
      throw error;
    }
  };

  const saveNewAnalysisToHarvestResult = async (harvestResultId: string, analysisResult: any, contentAnalysis: any) => {
    try {
      const updateData = {
        analysis_summary: contentAnalysis.summary,
        analysis_keywords: contentAnalysis.keywords,
        analysis_completed_at: new Date().toISOString()
      };
      
      await HarvestResultService.updateResult(harvestResultId, updateData);
      console.log('✅ Nouvelle analyse sauvegardée dans harvest_result:', harvestResultId);
    } catch (error) {
      console.error('❌ Erreur sauvegarde analyse:', error);
    }
  };

  const handleRequestAnalysis = () => {
    setShowConfirmation(true);
  };

  const handleConfirmAnalysis = () => {
    setShowConfirmation(false);
    startAnalysis(false); // Par défaut, analyse standard
  };

  const handleConfirmAnalysisWithOptions = (includeEmbeddings: boolean) => {
    setShowConfirmation(false);
    startAnalysis(includeEmbeddings);
  };

  const handleCancelAnalysis = () => {
    setShowConfirmation(false);
  };

  const startAnalysis = async (includeEmbeddings: boolean = false) => {
    setAnalyzing(true);
    setError('');
    setExtractedText('');
    setContentAnalysis(null);
    setAnalysisComplete(false);

    // Configurer le callback de progression
    DocumentAnalysisService.setProgressCallback((progress) => {
      setProgress(progress);
    });

    try {
      console.log('🚀 Début analyse pour:', docData.document_name);
      console.log('🔧 Options analyse:', { includeEmbeddings, forceNew: true });
      
      // Analyser le document
      const analysisResult = await DocumentAnalysisService.analyzeDocumentFromUrl(
        docData.url_doc,
        docData.filename,
        docData.harvest_result_parent_id || docData.id, // Utiliser l'UUID réel si disponible
        {
          language: 'fra+eng',
          useOpenAIVision: false,
          maxPages: 5,
          includeEmbeddings,
          forceNewAnalysis: true // FORCER une nouvelle analyse
        }
      );

      if (!analysisResult.success) {
        throw new Error(analysisResult.error || 'Échec de l\'extraction de texte');
      }

      // Si c'est une analyse cachée, utiliser les données sauvegardées
      if (analysisResult.method === 'cached') {
        console.log('⚠️ ATTENTION: Analyse cachée détectée malgré forceNewAnalysis=true');
        setContentAnalysis({
          summary: analysisResult.cachedSummary || 'Résumé non disponible',
          keywords: analysisResult.cachedKeywords || [],
          category: 'Analyse cachée',
          language: 'fr',
          sentiment: 'neutral',
          confidence: 0.9,
          topics: [],
          entities: { persons: [], locations: [], organizations: [], dates: [] },
          extraction_method: 'cached'
        });
        setExtractedText('Texte extrait précédemment (cache)');
        console.log('✅ Analyse récupérée du cache');
      } else {
        // Nouvelle analyse
      setExtractedText(analysisResult.extractedText);
      console.log('✅ Texte extrait:', analysisResult.extractedText.length, 'caractères');

      // Analyser le contenu avec OpenAI
      if (analysisResult.extractedText.length > 50) {
        setProgress({
          phase: 'analysis',
          message: 'Analyse intelligente du contenu...',
          progress: 90
        });

        const contentAnalysisResult = await ContentAnalysisService.analyzeContent(
          analysisResult.extractedText,
          docData.document_name,
          docData.url_doc
        );

        setContentAnalysis({
          ...contentAnalysisResult,
          extraction_method: analysisResult.method,
          embeddings_requested: includeEmbeddings,
          embeddings_generated: analysisResult.embeddingsGenerated || false
        });
        console.log('✅ Analyse de contenu terminée');
        
        if (includeEmbeddings) {
          console.log('🔍 Embeddings demandés:', analysisResult.embeddingsGenerated ? 'Générés' : 'Échec');
        }
      }
      }

      setAnalysisComplete(true);
      
      if (onAnalysisComplete) {
        onAnalysisComplete({
          extractedText: analysisResult.extractedText,
          analysis: contentAnalysis
        });
      }

    } catch (err) {
      console.error('❌ Erreur analyse:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadAnalysis = () => {
    if (!contentAnalysis) return;

    const analysisData = {
      documentInfo: {
        name: docData.document_name,
        url: docData.url_doc,
        filename: docData.filename
      },
      extracted_text: extractedText,
      analysis: contentAnalysis
    };

    const blob = new Blob([JSON.stringify(analysisData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `analysis_${docData.filename.replace(/\.[^/.]+$/, '')}.json`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'download':
        return <Download className="h-5 w-5 text-blue-600" />;
      case 'detection':
        return <Eye className="h-5 w-5 text-purple-600" />;
      case 'extraction':
        return <FileText className="h-5 w-5 text-orange-600" />;
      case 'ocr':
        return <Eye className="h-5 w-5 text-indigo-600" />;
      case 'analysis':
        return <Brain className="h-5 w-5 text-green-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Analyse de Contenu
              </h3>
              <p className="text-sm text-gray-500 truncate max-w-md">{docData.document_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={analyzing}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[calc(90vh-200px)] p-6 space-y-6">
          {/* Informations du document */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-md font-medium text-gray-900 mb-2">Document à analyser</h4>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Nom:</span> {docData.document_name}</div>
              <div><span className="font-medium">Fichier:</span> {docData.filename}</div>
              <div><span className="font-medium">URL:</span> <span className="break-all text-blue-600">{docData.url_doc}</span></div>
            </div>
          </div>

          {/* Progression d'analyse */}
          {analyzing && progress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                {getPhaseIcon(progress.phase)}
                <span className="ml-2 text-blue-700 font-medium">{progress.message}</span>
              </div>
              
              <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                ></div>
              </div>
              
              <div className="text-sm text-blue-600 space-y-1">
                <div>Progression: {Math.round(progress.progress)}%</div>
                {progress.currentPage && progress.totalPages && (
                  <div>Page: {progress.currentPage} / {progress.totalPages}</div>
                )}
                <div className="text-xs text-blue-500">
                  Phase: {progress.phase}
                </div>
              </div>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700 font-medium">Erreur d'analyse</span>
              </div>
              <p className="text-red-600 text-sm mt-2">{error}</p>
            </div>
          )}

          {/* Texte extrait */}
          {extractedText && (
            <div className="space-y-3">
              <h4 className="text-md font-medium text-gray-900 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-gray-600" />
                Texte Extrait ({extractedText.length} caractères)
              </h4>
              <div className="bg-gray-50 border rounded-lg p-4 max-h-64 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                  {extractedText.substring(0, 2000)}
                  {extractedText.length > 2000 && '\n\n... (texte tronqué pour l\'affichage)'}
                </pre>
              </div>
            </div>
          )}

          {/* Analyse de contenu */}
          {contentAnalysis && (
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 flex items-center">
                <Brain className="h-5 w-5 mr-2 text-purple-600" />
                Analyse Intelligente
              </h4>

              {/* Résumé */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h5 className="text-sm font-medium text-green-800 mb-2">📝 Résumé</h5>
                <p className="text-green-700 text-sm">{contentAnalysis.summary}</p>
              </div>

              {/* Métadonnées */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-blue-800 mb-2">🏷️ Mots-clés</h5>
                  <div className="flex flex-wrap gap-2">
                    {contentAnalysis.keywords.map((keyword: string, index: number) => (
                      <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-purple-800 mb-2">📂 Classification</h5>
                  <div className="space-y-1 text-sm">
                    <div><span className="font-medium">Catégorie:</span> {contentAnalysis.category}</div>
                    {contentAnalysis.subcategory && (
                      <div><span className="font-medium">Sous-catégorie:</span> {contentAnalysis.subcategory}</div>
                    )}
                    <div><span className="font-medium">Confiance:</span> {Math.round(contentAnalysis.confidence * 100)}%</div>
                  </div>
                </div>
              </div>

              {/* Entités */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h5 className="text-sm font-medium text-orange-800 mb-3">🎯 Entités Détectées</h5>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-orange-700">Personnes:</span>
                    <ul className="mt-1 space-y-1">
                      {contentAnalysis.entities.persons.map((person: string, index: number) => (
                        <li key={index} className="text-orange-600">• {person}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium text-orange-700">Lieux:</span>
                    <ul className="mt-1 space-y-1">
                      {contentAnalysis.entities.locations.map((location: string, index: number) => (
                        <li key={index} className="text-orange-600">• {location}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium text-orange-700">Organisations:</span>
                    <ul className="mt-1 space-y-1">
                      {contentAnalysis.entities.organizations.map((org: string, index: number) => (
                        <li key={index} className="text-orange-600">• {org}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium text-orange-700">Dates:</span>
                    <ul className="mt-1 space-y-1">
                      {contentAnalysis.entities.dates.map((date: string, index: number) => (
                        <li key={index} className="text-orange-600">• {date}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Sujets et sentiment */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-indigo-800 mb-2">📚 Sujets</h5>
                  <div className="flex flex-wrap gap-2">
                    {contentAnalysis.topics.map((topic: string, index: number) => (
                      <span key={index} className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-800 mb-2">📊 Métadonnées</h5>
                  <div className="space-y-1 text-sm">
                    <div><span className="font-medium">Langue:</span> {contentAnalysis.language}</div>
                    <div><span className="font-medium">Sentiment:</span> {contentAnalysis.sentiment}</div>
                    <div><span className="font-medium">Méthode:</span> {contentAnalysis.extraction_method}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Diagnostic des Embeddings - Toujours visible si analyse terminée */}
          {contentAnalysis && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h5 className="text-sm font-medium text-purple-800 mb-3 flex items-center">
                  <Brain className="h-4 w-4 mr-2" />
                  Diagnostic des Embeddings
                </h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-purple-700 font-medium">Statut:</span>
                    <div className="mt-1">
                      {contentAnalysis.embeddings_generated ? (
                        <span className="text-green-600 font-medium">✅ Générés avec succès</span>
                      ) : (
                        <span className="text-orange-600 font-medium">⚠️ Non générés</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-purple-700 font-medium">Modèle:</span>
                    <div className="mt-1 text-purple-600">text-embedding-ada-002</div>
                  </div>
                  <div>
                    <span className="text-purple-700 font-medium">Dimensions:</span>
                    <div className="mt-1 text-purple-600">1536 (OpenAI standard)</div>
                  </div>
                  <div>
                    <span className="text-purple-700 font-medium">Bénéfice:</span>
                    <div className="mt-1 text-purple-600">
                      {contentAnalysis.embeddings_generated ? 
                        '🎯 Recherche sémantique activée' : 
                        '❌ Recherche sémantique indisponible'
                      }
                    </div>
                  </div>
                </div>
                {contentAnalysis.embeddings_generated && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded p-2">
                    <div className="text-xs text-green-700 flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      <span>Vecteur sémantique sauvegardé - Recherche intelligente disponible</span>
                    </div>
                  </div>
                )}
              </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              {!analyzing && !analysisComplete && (
                <button
                  onClick={handleRequestAnalysis}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Brain className="h-4 w-4" />
                  <span>Analyser le contenu</span>
                </button>
              )}
              
              {contentAnalysis && (
                <button
                  onClick={handleDownloadAnalysis}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Télécharger l'analyse</span>
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              disabled={analyzing}
              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
            >
              {analyzing ? 'Analyse en cours...' : 'Fermer'}
            </button>
          </div>
        </div>
      </div>

      {/* Modale de confirmation */}
      {showConfirmation && (
        <React.Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-[85]" />}>
          <AnalysisConfirmationModal
            isOpen={showConfirmation}
            documentName={docData.document_name}
            onConfirm={handleConfirmAnalysisWithOptions}
            onCancel={handleCancelAnalysis}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export default DocumentAnalysisModal;