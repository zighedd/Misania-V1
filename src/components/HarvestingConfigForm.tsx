import React, { useState, useEffect } from 'react';
import { X, Save, Settings, Calendar, FileText, Globe2 } from 'lucide-react';
import type { Database } from '../lib/database.types';

type DataSource = Database['public']['Tables']['data_sources']['Row'];
type HarvestingConfig = Database['public']['Tables']['harvesting_configs']['Row'];

interface HarvestingConfigFormProps {
  dataSource: DataSource;
  config?: HarvestingConfig;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

const HarvestingConfigForm: React.FC<HarvestingConfigFormProps> = ({ 
  dataSource, 
  config, 
  onSubmit, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    frequency: 'daily',
    documentFormats: ['pdf', 'docx'],
    languages: ['FR'],
    dateRange: {
      start: '',
      end: ''
    },
    selectors: {
      titleSelector: '',
      contentSelector: '',
      dateSelector: '',
      linkSelector: ''
    },
    filters: {
      keywords: '',
      excludeKeywords: '',
      minSize: '',
      maxSize: ''
    },
    maxPages: 10,
    delayBetweenRequests: 1000
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (config) {
      const selectors = config.selectors as any || {};
      const filters = config.filters as any || {};
      
      setFormData({
        frequency: config.frequency,
        documentFormats: selectors.documentFormats || ['pdf', 'docx'],
        languages: selectors.languages || ['FR'],
        dateRange: {
          start: selectors.dateRange?.start || '',
          end: selectors.dateRange?.end || ''
        },
        selectors: {
          titleSelector: selectors.titleSelector || '',
          contentSelector: selectors.contentSelector || '',
          dateSelector: selectors.dateSelector || '',
          linkSelector: selectors.linkSelector || ''
        },
        filters: {
          keywords: filters.keywords || '',
          excludeKeywords: filters.excludeKeywords || '',
          minSize: filters.minSize || '',
          maxSize: filters.maxSize || ''
        },
        maxPages: config.max_pages || 10,
        delayBetweenRequests: config.delay_between_requests || 1000
      });
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const configData = {
        data_source_id: dataSource.id,
        frequency: formData.frequency,
        selectors: {
          ...formData.selectors,
          documentFormats: formData.documentFormats,
          languages: formData.languages,
          dateRange: formData.dateRange
        },
        filters: formData.filters,
        max_pages: formData.maxPages,
        delay_between_requests: formData.delayBetweenRequests
      };

      await onSubmit(configData);
    } catch (err) {
      console.error('Erreur lors de la configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentFormatChange = (format: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      documentFormats: checked 
        ? [...prev.documentFormats, format]
        : prev.documentFormats.filter(f => f !== format)
    }));
  };

  const handleLanguageChange = (language: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      languages: checked 
        ? [...prev.languages, language]
        : prev.languages.filter(l => l !== language)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Settings className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Configuration du moissonnage
              </h3>
              <p className="text-sm text-gray-500">{dataSource.name}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Planification */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h4 className="text-md font-medium text-gray-900">Planification</h4>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fréquence de moissonnage
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="manual">Manuel (déclenché par l'utilisateur)</option>
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={formData.dateRange.start}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={formData.dateRange.end}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Formats et langues */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <FileText className="h-5 w-5 text-purple-600" />
                <h4 className="text-md font-medium text-gray-900">Formats et Langues</h4>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Formats de documents
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['pdf', 'docx', 'doc', 'txt', 'html', 'xml'].map(format => (
                    <label key={format} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.documentFormats.includes(format)}
                        onChange={(e) => handleDocumentFormatChange(format, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 uppercase">{format}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Langues
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { code: 'FR', name: 'Français' },
                    { code: 'EN', name: 'Anglais' },
                    { code: 'AR', name: 'Arabe' },
                    { code: 'ES', name: 'Espagnol' },
                    { code: 'DE', name: 'Allemand' },
                    { code: 'IT', name: 'Italien' }
                  ].map(lang => (
                    <label key={lang.code} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.languages.includes(lang.code)}
                        onChange={(e) => handleLanguageChange(lang.code, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{lang.code}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Sélecteurs CSS */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <Globe2 className="h-5 w-5 text-indigo-600" />
                <h4 className="text-md font-medium text-gray-900">Sélecteurs CSS</h4>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sélecteur de titre
                  </label>
                  <input
                    type="text"
                    value={formData.selectors.titleSelector}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      selectors: { ...prev.selectors, titleSelector: e.target.value }
                    }))}
                    placeholder="h1, .title, [data-title]"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sélecteur de contenu
                  </label>
                  <input
                    type="text"
                    value={formData.selectors.contentSelector}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      selectors: { ...prev.selectors, contentSelector: e.target.value }
                    }))}
                    placeholder=".content, article, .post-body"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sélecteur de date
                  </label>
                  <input
                    type="text"
                    value={formData.selectors.dateSelector}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      selectors: { ...prev.selectors, dateSelector: e.target.value }
                    }))}
                    placeholder=".date, time, [datetime]"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sélecteur de liens
                  </label>
                  <input
                    type="text"
                    value={formData.selectors.linkSelector}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      selectors: { ...prev.selectors, linkSelector: e.target.value }
                    }))}
                    placeholder="a[href*='.pdf'], .download-link"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Filtres et limites */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <Settings className="h-5 w-5 text-orange-600" />
                <h4 className="text-md font-medium text-gray-900">Filtres et Limites</h4>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mots-clés à inclure
                </label>
                <input
                  type="text"
                  value={formData.filters.keywords}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    filters: { ...prev.filters, keywords: e.target.value }
                  }))}
                  placeholder="rapport, étude, analyse (séparés par des virgules)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mots-clés à exclure
                </label>
                <input
                  type="text"
                  value={formData.filters.excludeKeywords}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    filters: { ...prev.filters, excludeKeywords: e.target.value }
                  }))}
                  placeholder="brouillon, test, temporaire"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taille min (MB)
                  </label>
                  <input
                    type="number"
                    value={formData.filters.minSize}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      filters: { ...prev.filters, minSize: e.target.value }
                    }))}
                    placeholder="0.1"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taille max (MB)
                  </label>
                  <input
                    type="number"
                    value={formData.filters.maxSize}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      filters: { ...prev.filters, maxSize: e.target.value }
                    }))}
                    placeholder="50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Documents à récupérer
                  </label>
                  <input
                    type="number"
                    value={formData.maxPages}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxPages: parseInt(e.target.value) || 1 }))}
                    min="1"
                    max="1000"
                    placeholder="Laisser vide pour sans limite"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Délai entre requêtes (ms)
                  </label>
                  <input
                    type="number"
                    value={formData.delayBetweenRequests}
                    onChange={(e) => setFormData(prev => ({ ...prev, delayBetweenRequests: parseInt(e.target.value) || 1000 }))}
                    min="100"
                    step="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{config ? 'Mettre à jour' : 'Sauvegarder'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HarvestingConfigForm;