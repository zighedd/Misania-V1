import React, { useState, useEffect } from 'react';
import { X, Globe, Search, Eye, Calendar, FileText, ExternalLink, Brain, ChevronDown } from 'lucide-react';
import Pagination from './Pagination';
import { HarvestResultService } from '../services/harvestResultService';

// Lazy loading de la modale d'analyse
const DocumentAnalysisModal = React.lazy(() => import('./DocumentAnalysisModal'));

interface Document {
  id: string;
  harvest_result_parent_id?: string; // UUID réel pour les mises à jour
  source: string;
  source_alt: string;
  url_doc: string;
  url_pdf: string;
  document_name: string;
  date_edition: string;
  auteurs: string;
  langue: string;
  resume: string;
  statut: string;
  issue_number: string;
  annee: number;
  filename: string;
  format: string;
  type_document: string;
  contient_texte: string;
  pattern_verified: boolean;
  notes: string;
  obstacles: string;
  blobUrl?: string; // URL blob pour contourner CORS
  hasAnalysis?: boolean; // Indique si le document a déjà été analysé
  analysisKeywords?: string[]; // Mots-clés de l'analyse
  hasEmbeddings?: boolean; // Indique si le document a des embeddings
}

interface DocumentsModalProps {
  isOpen: boolean;
  websiteName: string;
  websiteUrl: string;
  websiteId: string;
  onClose: () => void;
}

const DocumentsModal: React.FC<DocumentsModalProps> = ({
  isOpen,
  websiteName,
  websiteUrl,
  websiteId,
  onClose
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('date_edition');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [viewerDocument, setViewerDocument] = useState<Document | null>(null);
  const [viewerError, setViewerError] = useState<string>('');
  const [analysisModal, setAnalysisModal] = useState<{
    isOpen: boolean;
    document: Document | null;
  }>({ isOpen: false, document: null });

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen, websiteId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Récupérer les vrais documents depuis la base de données
      const realDocuments = await HarvestResultService.getDocumentsByDataSource(websiteId);
      
      // Mapper les données vers le format attendu par l'interface
      const formattedDocuments: Document[] = realDocuments.map(doc => ({
        id: doc.id,
        harvest_result_parent_id: doc.harvest_result_parent_id,
        source: doc.source_page || '',
        source_alt: doc.source_page || '',
        url_doc: doc.url_doc || '',
        url_pdf: doc.url_doc || '',
        document_name: doc.document_name || '',
        date_edition: doc.date_edition || '',
        auteurs: doc.auteurs || '',
        langue: doc.langue || '',
        resume: doc.analysis_summary || doc.resume || '', // Utiliser le résumé analysé en priorité
        statut: doc.statut || '',
        issue_number: doc.issue_number || '',
        annee: doc.annee || new Date().getFullYear(),
        filename: doc.filename || '',
        format: doc.format || '',
        type_document: doc.type_document || '',
        contient_texte: doc.contient_texte || '',
        pattern_verified: doc.pattern_verified || false,
        notes: doc.notes || '',
        obstacles: doc.obstacles || '',
        // Ajouter les données d'analyse
        hasAnalysis: !!doc.analysis_completed_at,
        analysisKeywords: doc.analysis_keywords as string[] || [],
        // Vérifier la présence d'embeddings dans les métadonnées - diagnostic renforcé
        hasEmbeddings: (() => {
          const metadata = doc.metadata as any;
          const hasEmbedding = metadata && 
                              metadata.embedding && 
                              metadata.embedding.embedding && 
                              Array.isArray(metadata.embedding.embedding) && 
                              metadata.embedding.embedding.length === 1536;
          console.log(`🔍 DIAGNOSTIC BADGE - Document ${doc.document_name}:`, {
            hasMetadata: !!metadata,
            hasEmbeddingObject: !!(metadata?.embedding),
            hasEmbeddingArray: !!(metadata?.embedding?.embedding),
            isArray: Array.isArray(metadata?.embedding?.embedding),
            arrayLength: metadata?.embedding?.embedding?.length,
            finalResult: hasEmbedding
          });
          return hasEmbedding;
        })()
      }));
      
      setDocuments(formattedDocuments);
    } catch (err) {
      console.error('Erreur lors du chargement des documents:', err);
      // En cas d'erreur, afficher un tableau vide plutôt que de planter
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDocument = (id: string) => {
    setSelectedDocuments(prev => {
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
    if (selectedDocuments.size === finalPaginatedDocuments.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(finalPaginatedDocuments.map(d => d.id)));
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleViewDetails = (document: Document) => {
    setSelectedDocument(document);
  };

  const handleViewDocument = async (doc: Document) => {
    setViewerError('');
    setViewerDocument(doc);
    
    console.log('🔍 Tentative de visualisation:', doc.document_name);
    
    try {
      // Utiliser le proxy pour récupérer le document et créer une URL blob
      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-proxy`;
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: doc.url_doc })
      });

      if (!response.ok) {
        throw new Error(`Erreur proxy: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      setViewerDocument({
        ...doc,
        blobUrl
      });
      
      console.log('✅ Document chargé via proxy');
    } catch (error) {
      console.error('❌ Erreur chargement document:', error);
      setViewerError(`Impossible de charger le document: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  // Fonction pour sauvegarder le PDF localement (optionnel)
  const savePdfLocally = async (filename: string, blob: Blob) => {
    try {
      // Créer le répertoire documents s'il n'existe pas
      const formData = new FormData();
      formData.append('file', blob, filename);
      formData.append('path', '/documents/');
      
      // Appel API pour sauvegarder le fichier (à implémenter côté serveur)
      const saveResponse = await fetch('/api/save-document', {
        method: 'POST',
        body: formData
      });
      
      if (!saveResponse.ok) {
        throw new Error('Erreur de sauvegarde serveur');
      }
      
      console.log('✅ Fichier sauvegardé avec succès');
    } catch (error) {
      console.log('❌ Erreur de sauvegarde locale:', error);
      throw error;
    }
  };

  const handleCloseDetails = () => {
    setSelectedDocument(null);
  };

  const handleAnalyzeContent = (document: Document) => {
    setAnalysisModal({
      isOpen: true,
      document: {
        id: document.id,
        harvest_result_parent_id: document.harvest_result_parent_id,
        url_doc: document.url_doc,
        filename: document.filename,
        document_name: document.document_name,
        local_path: document.local_path
      }
    });
  };

  const handleCloseAnalysis = () => {
    setAnalysisModal({ isOpen: false, document: null });
  };

  const handleAnalysisComplete = (analysis: any) => {
    console.log('✅ Analyse terminée pour:', analysisModal.document?.document_name);
    // Rafraîchir les données pour mettre à jour les badges
    loadDocuments();
  };

  const handleCloseViewer = () => {
    // Nettoyer l'URL blob si elle existe
    if (viewerDocument?.blobUrl) {
      URL.revokeObjectURL(viewerDocument.blobUrl);
    }
    setViewerDocument(null);
    setViewerError('');
  };

  const getDocumentUrl = (doc: Document) => {
    // Toujours utiliser le proxy pour contourner CORS, même pour la visualisation
    return getProxyUrl(doc.url_doc);
  };

  const getProxyUrl = (url: string) => {
    // URL du proxy pour téléchargement/analyse
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-proxy`;
    return proxyUrl;
  };

  // Filtrage et tri des documents
  const filteredDocuments = documents
    .filter(doc => {
      const searchLower = searchTerm.toLowerCase();
      return doc.document_name.toLowerCase().includes(searchLower) ||
             doc.filename.toLowerCase().includes(searchLower) ||
             doc.date_edition.includes(searchTerm) ||
             doc.auteurs.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'document_name':
          aValue = a.document_name.toLowerCase();
          bValue = b.document_name.toLowerCase();
          break;
        case 'date_edition':
          aValue = new Date(a.date_edition);
          bValue = new Date(b.date_edition);
          break;
        case 'filename':
          aValue = a.filename.toLowerCase();
          bValue = b.filename.toLowerCase();
          break;
        case 'format':
          aValue = a.format;
          bValue = b.format;
          break;
        case 'auteurs':
          aValue = a.auteurs.toLowerCase();
          bValue = b.auteurs.toLowerCase();
          break;
        default:
          aValue = new Date(a.date_edition);
          bValue = new Date(b.date_edition);
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  // Pagination
  const totalItems = filteredDocuments.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const finalPaginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedDocuments(new Set());
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Documents Moissonnés</h3>
                <div className="text-sm text-gray-500">
                  <div className="font-medium">{websiteName}</div>
                  <div className="break-all">{websiteUrl}</div>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Pagination en haut */}
          {!loading && documents.length > 0 && totalPages > 1 && (
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={itemsPerPage}
                totalItems={totalItems}
              />
            </div>
          )}

          {/* Barre de recherche et actions */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, fichier, date ou auteur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {selectedDocuments.size > 0 && (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">
                    {selectedDocuments.size} document(s) sélectionné(s)
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[calc(90vh-200px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Chargement des documents...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun document</h3>
                <p className="text-gray-500">
                  Aucun document n'a encore été moissonné pour ce site.
                </p>
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
                            checked={selectedDocuments.size === finalPaginatedDocuments.length && finalPaginatedDocuments.length > 0}
                            onChange={handleSelectAll}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('document_name')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Document</span>
                            {sortField === 'document_name' && (
                              <ChevronDown className={`h-3 w-3 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('filename')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Fichier</span>
                            {sortField === 'filename' && (
                              <ChevronDown className={`h-3 w-3 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('date_edition')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Date d'édition</span>
                            {sortField === 'date_edition' && (
                              <ChevronDown className={`h-3 w-3 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('format')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Format</span>
                            {sortField === 'format' && (
                              <ChevronDown className={`h-3 w-3 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('auteurs')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Auteurs</span>
                            {sortField === 'auteurs' && (
                              <ChevronDown className={`h-3 w-3 transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {finalPaginatedDocuments.map((document) => (
                        <tr key={document.id} className={`hover:bg-gray-50 transition-colors ${
                          selectedDocuments.has(document.id) ? 'bg-blue-50' : ''
                        }`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedDocuments.has(document.id)}
                              onChange={() => handleSelectDocument(document.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8">
                                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <FileText className="h-4 w-4 text-green-600" />
                                </div>
                              </div>
                              <div className="ml-4 max-w-xs">
                                <div className="text-sm font-medium text-gray-900 truncate" title={document.document_name}>
                                  {document.document_name}
                                </div>
                                <div className="text-sm text-gray-500 truncate" title={document.resume}>
                                  {document.resume}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleViewDocument(document)}
                              className="text-sm text-blue-600 hover:text-blue-800 font-mono hover:underline transition-colors cursor-pointer"
                              title="Cliquer pour visualiser le document"
                            >
                              {document.filename}
                            </button>
                            <div className="text-sm text-gray-500">#{document.issue_number}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-900">{formatDate(document.date_edition)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 uppercase">
                              {document.format}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs truncate" title={document.auteurs}>
                              {document.auteurs}
                            </div>
                            <div className="text-sm text-gray-500">{document.langue}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => handleAnalyzeContent(document)}
                                className={`p-2 rounded-lg transition-colors ${
                                  document.hasAnalysis 
                                    ? 'text-green-600 hover:text-green-800 hover:bg-green-50' 
                                    : 'text-purple-600 hover:text-purple-800 hover:bg-purple-50'
                                }`}
                                title={document.hasAnalysis ? 'Voir l\'analyse existante' : 'Analyser le contenu'}
                              >
                                <Brain className={`h-4 w-4 ${document.hasAnalysis ? 'text-green-600' : ''}`} />
                              </button>
                              <button
                                onClick={() => handleViewDetails(document)}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                title="Voir les détails"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {totalItems} document(s) au total
                {selectedDocuments.size > 0 && ` • ${selectedDocuments.size} sélectionné(s)`}
              </div>
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

      {/* Visualiseur de document intégré */}
      {viewerDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[95vh] mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Visualisation du Document</h3>
                  <p className="text-sm text-gray-600 truncate max-w-md">{viewerDocument.document_name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.open(viewerDocument.url_doc, '_blank')}
                  className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                  title="Ouvrir dans un nouvel onglet"
                >
                  <ExternalLink className="h-5 w-5" />
                </button>
                <button
                  onClick={handleCloseViewer}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 h-full">
              {viewerError ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Erreur de visualisation</h3>
                    <p className="text-gray-600 mb-4">{viewerError}</p>
                    <button
                      onClick={() => window.open(viewerDocument.url_doc, '_blank')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Ouvrir dans un nouvel onglet</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-gray-100">
                  <iframe
                    src={viewerDocument.blobUrl || viewerDocument.url_doc}
                    className="w-full h-full border-0"
                    title={viewerDocument.document_name}
                    onError={() => setViewerError('Impossible de charger le document')}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale de détails du document */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[65]">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Détails du Document</h3>
              </div>
              <button
                onClick={handleCloseDetails}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du document</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDocument.document_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du fichier</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded font-mono">{selectedDocument.filename}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut d'analyse</label>
                    <div className="flex items-center space-x-3">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedDocument.hasAnalysis 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedDocument.hasAnalysis ? '✅ Analysé' : '⚪ Non analysé'}
                      </div>
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedDocument.hasEmbeddings 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {selectedDocument.hasEmbeddings ? '🧠 Embedded' : '⚫ No Embedding'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date d'édition</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{formatDate(selectedDocument.date_edition)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Auteurs</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDocument.auteurs}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Langue</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDocument.langue}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded uppercase">{selectedDocument.format}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type de document</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDocument.type_document}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDocument.statut}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL du document</label>
                    <div className="bg-gray-50 p-2 rounded">
                      <a 
                        href={selectedDocument.url_doc} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 break-all"
                      >
                        {selectedDocument.url_doc}
                      </a>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL PDF</label>
                    <div className="bg-gray-50 p-2 rounded">
                      <a 
                        href={selectedDocument.url_pdf} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 break-all"
                      >
                        {selectedDocument.url_pdf}
                      </a>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                    <div className="bg-gray-50 p-2 rounded">
                      <a 
                        href={selectedDocument.source} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 break-all"
                      >
                        {selectedDocument.source}
                      </a>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Résumé</label>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-sm text-gray-900">{selectedDocument.resume}</p>
                      {selectedDocument.hasAnalysis && selectedDocument.analysisKeywords && selectedDocument.analysisKeywords.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <span className="text-xs font-medium text-gray-600 mb-1 block">Mots-clés (analyse IA) :</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedDocument.analysisKeywords.map((keyword, index) => (
                              <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro d'édition</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDocument.issue_number}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDocument.annee}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contenu texte</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDocument.contient_texte}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PDF vérifié</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                      {selectedDocument.pattern_verified ? 'Oui' : 'Non'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes et obstacles */}
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{selectedDocument.notes}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Obstacles</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{selectedDocument.obstacles}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleViewDocument(selectedDocument)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Visualiser le document</span>
                  </button>
                </div>
                <button
                  onClick={handleCloseDetails}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'analyse de contenu */}
      {analysisModal.isOpen && analysisModal.document && (
        <React.Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-[75]" />}>
          <DocumentAnalysisModal
            isOpen={analysisModal.isOpen}
            docData={analysisModal.document}
            onClose={handleCloseAnalysis}
            onAnalysisComplete={handleAnalysisComplete}
          />
        </React.Suspense>
      )}
    </>
  );
};

export default DocumentsModal;