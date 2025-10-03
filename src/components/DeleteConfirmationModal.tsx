import React from 'react';
import { AlertTriangle, X, Globe, Settings, History, AlertCircle } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  websiteName: string;
  websiteUrl: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  websiteName,
  websiteUrl,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all">
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 bg-red-100 rounded-full p-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Confirmer la suppression
              </h3>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center space-x-2 mb-1">
                  <Globe className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-gray-900">{websiteName}</span>
                </div>
                <p className="text-sm text-gray-600 break-all">{websiteUrl}</p>
              </div>

              <p className="text-sm text-gray-700 mb-4">
                Êtes-vous sûr de vouloir supprimer ce site ? Cette action est irréversible et supprimera :
              </p>

              <ul className="space-y-2 mb-4">
                <li className="flex items-center space-x-2 text-sm text-gray-700">
                  <Settings className="h-4 w-4 text-gray-500" />
                  <span>La configuration du site</span>
                </li>
                <li className="flex items-center space-x-2 text-sm text-gray-700">
                  <History className="h-4 w-4 text-gray-500" />
                  <span>L'historique des moissonnages</span>
                </li>
                <li className="flex items-center space-x-2 text-sm text-gray-700">
                  <AlertCircle className="h-4 w-4 text-gray-500" />
                  <span>Toutes les alertes associées</span>
                </li>
              </ul>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-orange-600 font-medium">⚠️</span>
                  <span className="text-sm text-orange-800 font-medium">
                    Cette action ne peut pas être annulée
                  </span>
                </div>
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
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded-lg transition-colors"
          >
            Supprimer définitivement
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;