import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Clock, MessageSquare, Save } from 'lucide-react';
import { HarvestLogService } from '../services/harvestLogService';
import { DataSourceService } from '../services/dataSourceService';
import type { Database } from '../lib/database.types';

type DataSource = Database['public']['Tables']['data_sources']['Row'];

interface Alert {
  id: string;
  name: string;
  url: string;
  date: string;
  time: string;
  incident: string;
  comment?: string;
}

interface AlertsModalProps {
  isOpen: boolean;
  websiteName: string;
  websiteId: string;
  onClose: () => void;
}

const AlertsModal: React.FC<AlertsModalProps> = ({
  isOpen,
  websiteName,
  websiteId,
  onClose
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteInfo, setSiteInfo] = useState<DataSource | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAlerts();
      loadSiteInfo();
    }
  }, [isOpen, websiteId]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      // Récupérer les vraies alertes depuis la base de données
      const realLogs = await HarvestLogService.getLogsByDataSource(websiteId);
      
      // Mapper les logs vers le format attendu par l'interface
      const formattedAlerts: Alert[] = realLogs.map(log => {
        const createdAt = new Date(log.created_at);
        const details = log.details as any || {};
        
        return {
          id: log.id,
          name: getSeverityName(log.level),
          url: details.url || details.source_page || '',
          date: createdAt.toISOString().split('T')[0],
          time: createdAt.toTimeString().split(' ')[0],
          incident: log.message,
          comment: details.comment || ''
        };
      });
      
      // Trier par date (plus récent en premier)
      const sortedAlerts = formattedAlerts.sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time}`);
        const dateTimeB = new Date(`${b.date}T${b.time}`);
        return dateTimeB.getTime() - dateTimeA.getTime();
      });
      
      setAlerts(sortedAlerts);
    } catch (err) {
      console.error('Erreur lors du chargement des alertes:', err);
      // En cas d'erreur, afficher un tableau vide
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSiteInfo = async () => {
    try {
      const site = await DataSourceService.getDataSourceById(websiteId);
      setSiteInfo(site);
    } catch (err) {
      console.error('Erreur lors du chargement des informations du site:', err);
      setSiteInfo(null);
    }
  };

  const getSeverityName = (level: string) => {
    switch (level) {
      case 'error':
        return 'Erreur critique';
      case 'warning':
        return 'Avertissement';
      case 'info':
        return 'Information';
      default:
        return 'Incident';
    }
  };

  const handleEditComment = (alertId: string, currentComment: string) => {
    setEditingComment(alertId);
    setCommentText(currentComment);
  };

  const handleSaveComment = async (alertId: string) => {
    try {
      // TODO: Sauvegarder le commentaire via API
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, comment: commentText }
            : alert
        )
      );
      setEditingComment(null);
      setCommentText('');
    } catch (err) {
      console.error('Erreur lors de la sauvegarde du commentaire:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
    setCommentText('');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getIncidentSeverity = (incident: string) => {
    if (incident.toLowerCase().includes('erreur') || incident.toLowerCase().includes('error')) {
      return 'error';
    }
    if (incident.toLowerCase().includes('timeout') || incident.toLowerCase().includes('inaccessible')) {
      return 'warning';
    }
    return 'info';
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Historique des Incidents
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

        <div className="flex-1 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Chargement des alertes...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun incident enregistré</h3>
              <p className="text-gray-500">
                Aucun incident n'a été enregistré pour ce site. Les incidents apparaîtront ici lors des prochains moissonnages.
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {alerts.map((alert) => {
                const severity = getIncidentSeverity(alert.incident);
                const isEditing = editingComment === alert.id;
                
                return (
                  <div key={alert.id} className={`border rounded-lg p-4 ${getSeverityStyles(severity)}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">{alert.name}</h4>
                        {alert.url && (
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                            <span className="break-all">{alert.url}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{formatDate(alert.date)} à {alert.time}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white bg-opacity-70 rounded-lg p-3 mb-3">
                      <h5 className="text-sm font-medium text-gray-900 mb-1">Détail de l'incident :</h5>
                      <p className="text-sm text-gray-700">{alert.incident}</p>
                    </div>

                    <div className="bg-white bg-opacity-70 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="h-4 w-4 text-gray-600" />
                          <h5 className="text-sm font-medium text-gray-900">Commentaire :</h5>
                        </div>
                        {!isEditing && (
                          <button
                            onClick={() => handleEditComment(alert.id, alert.comment || '')}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                          >
                            {alert.comment ? 'Modifier' : 'Ajouter'}
                          </button>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div className="space-y-3">
                          <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Ajoutez vos consignes ou actions à entreprendre..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => handleSaveComment(alert.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center space-x-1 transition-colors"
                            >
                              <Save className="h-3 w-3" />
                              <span>Sauvegarder</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-700">
                          {alert.comment ? (
                            <p className="italic">{alert.comment}</p>
                          ) : (
                            <p className="text-gray-500 italic">Aucun commentaire ajouté</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Obstacles globaux */}
          {siteInfo && siteInfo.obstacles_globaux && siteInfo.obstacles_globaux.length > 0 && (
            <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <h4 className="text-md font-medium text-orange-800 mb-3 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Obstacles Globaux du Site
              </h4>
              <ul className="space-y-2">
                {siteInfo.obstacles_globaux.map((obstacle, index) => (
                  <li key={index} className="text-sm text-orange-700 bg-white bg-opacity-70 rounded p-2">
                    • {obstacle}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommandations */}
          {siteInfo && siteInfo.recommandations && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-md font-medium text-blue-800 mb-3 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Recommandations
              </h4>
              <div className="text-sm text-blue-700 bg-white bg-opacity-70 rounded p-3">
                {siteInfo.recommandations}
              </div>
            </div>
          )}
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

export default AlertsModal;