import React from 'react';
import { AlertTriangle, X, Brain, Clock, DollarSign, Search, Zap } from 'lucide-react';

interface AnalysisConfirmationModalProps {
  isOpen: boolean;
  documentName: string;
  onConfirm: (includeEmbeddings: boolean) => void;
  onCancel: () => void;
}

const AnalysisConfirmationModal: React.FC<AnalysisConfirmationModalProps> = ({
  isOpen,
  documentName,
  onConfirm,
  onCancel
}) => {
  const [selectedOption, setSelectedOption] = React.useState<'standard' | 'embeddings'>('standard');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all">
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 bg-orange-100 rounded-full p-3">
              <Brain className="h-6 w-6 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Confirmer l'analyse de contenu
              </h3>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="font-medium text-gray-900 text-sm truncate" title={documentName}>
                  {documentName}
                </p>
              </div>

              <p className="text-sm text-gray-700 mb-4">
                Choisissez le type d'analyse à effectuer pour ce document :
              </p>

              {/* Options d'analyse */}
              <div className="space-y-3 mb-4">
                {/* Option 1: Analyse standard */}
                <div 
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedOption === 'standard' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedOption('standard')}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="radio"
                      checked={selectedOption === 'standard'}
                      onChange={() => setSelectedOption('standard')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Brain className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-gray-900">Analyse Standard</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Extraction de texte + résumé automatique + mots-clés
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>30s - 1 min</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span>~$0.01</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Option 2: Analyse avec embeddings */}
                <div 
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedOption === 'embeddings' 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedOption('embeddings')}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="radio"
                      checked={selectedOption === 'embeddings'}
                      onChange={() => setSelectedOption('embeddings')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Search className="h-5 w-5 text-purple-600" />
                        <span className="font-medium text-gray-900">Analyse Complète + Embeddings</span>
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                          Recommandé
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Analyse standard + calcul des vecteurs sémantiques pour la recherche intelligente
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>1 - 2 min</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span>~$0.02</span>
                        </div>
                      </div>
                      <div className="bg-purple-100 border border-purple-200 rounded p-2">
                        <div className="flex items-center space-x-1 text-purple-800 text-xs">
                          <Zap className="h-3 w-3" />
                          <span className="font-medium">Permet la recherche sémantique future</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informations sur l'option sélectionnée */}
              <div className={`border rounded-lg p-3 ${
                selectedOption === 'embeddings' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className={`flex items-center space-x-2 ${
                  selectedOption === 'embeddings' ? 'text-purple-800' : 'text-blue-800'
                }`}>
                  <span className="font-medium">ℹ️</span>
                  <span className="text-sm font-medium">
                    {selectedOption === 'embeddings' ? 'L\'analyse complète inclura :' : 'L\'analyse standard inclura :'}
                  </span>
                </div>
                <ul className={`text-sm mt-2 space-y-1 ml-6 ${
                  selectedOption === 'embeddings' ? 'text-purple-700' : 'text-blue-700'
                }`}>
                  <li>• Extraction du texte intégral</li>
                  <li>• Résumé automatique</li>
                  <li>• Mots-clés et entités</li>
                  <li>• Classification et sentiment</li>
                  {selectedOption === 'embeddings' && (
                    <li>• <strong>Vecteurs sémantiques pour recherche intelligente</strong></li>
                  )}
                </ul>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-lg">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(selectedOption === 'embeddings')}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
              selectedOption === 'embeddings'
                ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }`}
          >
            {selectedOption === 'embeddings' ? 'Lancer l\'analyse complète' : 'Lancer l\'analyse standard'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisConfirmationModal;