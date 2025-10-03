import React, { useState, useEffect } from 'react';
import { X, Save, Settings, Calendar, FileText, Globe2 } from 'lucide-react';
import { DatabaseConstraintService } from '../services/databaseConstraintService';
import type { Database } from '../lib/database.types';

type DataSource = Database['public']['Tables']['data_sources']['Row'];
type HarvestingConfig = Database['public']['Tables']['harvesting_configs']['Row'];

interface WebsiteConfigFormProps {
  website?: DataSource;
  config?: HarvestingConfig;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export default function WebsiteConfigForm({ 
  website, 
  config,
  onSubmit, 
  onCancel 
}: WebsiteConfigFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    type: 'web',
    status: 'active',
    description: '',
    specialInstructions: '',
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [nameValidation, setNameValidation] = useState<{
    isChecking: boolean;
    isUnique: boolean;
    suggestion?: string;
  }>({ isChecking: false, isUnique: true });

  useEffect(() => {
    if (website) {
      setFormData(prev => ({
        ...prev,
        name: website.name,
        url: website.url,
        type: website.type,
        status: website.status,
        description: website.description,
        specialInstructions: website.special_instructions || '',
        generatedPrompt: website.generated_prompt || ''
      }));
    }
    
    // Charger les paramètres de configuration depuis la base de données
    if (config) {
      const selectors = config.selectors as any || {};
      const filters = config.filters as any || {};
      
      setFormData(prev => ({
        ...prev,
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
        maxPages: config.max_pages || '',
        delayBetweenRequests: config.delay_between_requests || ''
      }));
    } else {
      // Pour un nouveau site, initialiser avec des valeurs vides
      setFormData(prev => ({
        ...prev,
        maxPages: '',
        delayBetweenRequests: ''
      }));
    }
  }, [website, config]);

  // Générer le prompt à partir des données du formulaire
  useEffect(() => {
    const generatePrompt = () => {
      if (!formData.url) {
        setGeneratedPrompt('');
        return;
      }

      let prompt = `Je voudrais moissonner le site ${formData.url}`;

      // Ajouter les formats de documents
      if (formData.documentFormats.length > 0) {
        prompt += ` pour récupérer les documents de type ${formData.documentFormats.join(', ')}`;
      }

      // Ajouter la plage de dates
      if (formData.dateRange.start && formData.dateRange.end) {
        const startDate = new Date(formData.dateRange.start).toLocaleDateString('fr-FR');
        const endDate = new Date(formData.dateRange.end).toLocaleDateString('fr-FR');
        prompt += ` du ${startDate} au ${endDate}`;
      } else if (formData.dateRange.start) {
        const startDate = new Date(formData.dateRange.start).toLocaleDateString('fr-FR');
        prompt += ` à partir du ${startDate}`;
      } else if (formData.dateRange.end) {
        const endDate = new Date(formData.dateRange.end).toLocaleDateString('fr-FR');
        prompt += ` jusqu'au ${endDate}`;
      }

      // Ajouter les langues
      if (formData.languages.length > 0) {
        const languesFr = formData.languages.map((lang: string) => {
          switch (lang) {
            case 'FR': return 'français';
            case 'EN': return 'anglais';
            case 'AR': return 'arabe';
            case 'ES': return 'espagnol';
            case 'DE': return 'allemand';
            case 'IT': return 'italien';
            default: return lang.toLowerCase();
          }
        });
        prompt += ` en langue ${languesFr.join(' et ')}`;
      }

      // Ajouter les mots-clés à inclure
      if (formData.filters.keywords && formData.filters.keywords.trim()) {
        prompt += `. Je veux uniquement les documents contenant les mots-clés suivants : ${formData.filters.keywords}`;
      }

      // Ajouter les mots-clés à exclure
      if (formData.filters.excludeKeywords && formData.filters.excludeKeywords.trim()) {
        prompt += `. Exclure les documents contenant : ${formData.filters.excludeKeywords}`;
      }

      // Ajouter les contraintes de taille
      if (formData.filters.minSize || formData.filters.maxSize) {
        prompt += '. Contraintes de taille :';
        if (formData.filters.minSize) {
          prompt += ` minimum ${formData.filters.minSize}MB`;
        }
        if (formData.filters.maxSize) {
          if (formData.filters.minSize) prompt += ' et';
          prompt += ` maximum ${formData.filters.maxSize}MB`;
        }
      }

      // Ajouter les paramètres techniques
      const technicalParams = [];
      if (formData.maxPages && formData.maxPages.toString().trim()) {
        technicalParams.push(`collecter maximum ${formData.maxPages} documents`);
      }
      if (formData.delayBetweenRequests && formData.delayBetweenRequests.toString().trim()) {
        technicalParams.push(`délai de ${formData.delayBetweenRequests}ms entre chaque requête`);
      }
      if (technicalParams.length > 0) {
        prompt += `. Paramètres techniques : ${technicalParams.join(' avec un ')}`;
      }

      prompt += '.';
      setGeneratedPrompt(prompt);
    };

    generatePrompt();
  }, [formData]);

  // Validation en temps réel du nom
  useEffect(() => {
    const validateName = async () => {
      if (!formData.name.trim() || formData.name === website?.name) {
        setNameValidation({ isChecking: false, isUnique: true });
        return;
      }

      setNameValidation({ isChecking: true, isUnique: true });
      
      try {
        const validation = await DatabaseConstraintService.validateDataSourceName(formData.name, website?.id);
        
        setNameValidation({ 
          isChecking: false, 
          isUnique: validation.isValid,
          suggestion: validation.suggestion
        });
        
        if (!validation.isValid && validation.error) {
          setErrors(prev => ({ ...prev, name: validation.error! }));
        } else {
          setErrors(prev => ({ ...prev, name: '' }));
        }
      } catch (error) {
        console.error('Erreur lors de la validation du nom:', error);
        setNameValidation({ isChecking: false, isUnique: true });
      }
    };

    const timeoutId = setTimeout(validateName, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.name, website?.name]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    } else if (!nameValidation.isUnique) {
      newErrors.name = 'Ce nom est déjà utilisé';
    }

    if (!formData.url.trim()) {
      newErrors.url = 'L\'URL est requise';
    } else {
      try {
        new URL(formData.url);
      } catch {
        newErrors.url = 'URL invalide';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Séparer les données du site et de la configuration
      const siteData = {
        name: formData.name,
        url: formData.url,
        type: formData.type,
        status: formData.status,
        description: formData.description,
        special_instructions: formData.specialInstructions,
        generated_prompt: generatedPrompt
      };

      const configData = {
        frequency: formData.frequency,
        selectors: {
          ...formData.selectors,
          documentFormats: formData.documentFormats,
          languages: formData.languages,
          dateRange: formData.dateRange
        },
        filters: formData.filters,
        max_pages: formData.maxPages ? parseInt(formData.maxPages.toString()) : null,
        delay_between_requests: formData.delayBetweenRequests ? parseInt(formData.delayBetweenRequests.toString()) : null
      };

      // Passer les deux objets à la fonction parent
      await onSubmit({ siteData, configData });
    } catch (err) {
      console.error('Erreur lors de la soumission:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
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
            <div className="bg-blue-100 p-2 rounded-lg">
              <Globe2 className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {website ? 'Modifier le site' : 'Configurer un nouveau site'}
            </h3>
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
            {/* Informations de base */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <Globe2 className="h-5 w-5 text-blue-600" />
                <h4 className="text-md font-medium text-gray-900">Informations du Site</h4>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du site *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name || !nameValidation.isUnique ? 'border-red-300' : 
                    nameValidation.isChecking ? 'border-yellow-300' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Site d'actualités"
                />
                {nameValidation.isChecking && (
                  <p className="text-yellow-600 text-xs mt-1 flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600 mr-1"></div>
                    Vérification de l'unicité...
                  </p>
                )}
                {!nameValidation.isUnique && nameValidation.suggestion && (
                  <div className="mt-1">
                    <p className="text-red-500 text-xs">Ce nom est déjà utilisé</p>
                    <button
                      type="button"
                      onClick={() => handleChange('name', nameValidation.suggestion!)}
                      className="text-blue-600 hover:text-blue-800 text-xs underline mt-1"
                    >
                      Utiliser: "{nameValidation.suggestion}"
                    </button>
                  </div>
                )}
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => handleChange('url', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.url ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="https://example.com"
                />
                {errors.url && <p className="text-red-500 text-xs mt-1">{errors.url}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                  <option value="suspended">Suspendu</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Description optionnelle du site..."
                />
              </div>
            </div>

            {/* Planification */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <Calendar className="h-5 w-5 text-green-600" />
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
                <Settings className="h-5 w-5 text-indigo-600" />
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
                <FileText className="h-5 w-5 text-orange-600" />
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
                    onChange={(e) => setFormData(prev => ({ ...prev, maxPages: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, delayBetweenRequests: e.target.value }))}
                    min="100"
                    step="100"
                    placeholder="Optionnel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Zone de consignes particulières */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-2 mb-3">
              <FileText className="h-5 w-5 text-indigo-600" />
              <h4 className="text-md font-medium text-gray-900">Consignes Particulières</h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instructions spécifiques pour ce site
              </label>
              <textarea
                value={formData.specialInstructions}
                onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                placeholder="Ajoutez ici des consignes spécifiques pour le moissonnage de ce site (ex: éviter certaines sections, privilégier certains types de contenu, etc.)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ces consignes seront ajoutées au prompt de moissonnage pour personnaliser le comportement selon les spécificités de ce site.
              </p>
            </div>
          </div>

          {/* Aperçu du prompt généré */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-2 mb-3">
              <FileText className="h-5 w-5 text-green-600" />
              <h4 className="text-md font-medium text-gray-900">Aperçu du Prompt Généré</h4>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {generatedPrompt || "Le prompt sera généré automatiquement dès que vous saisirez une URL..."}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Ce prompt sera utilisé pour le moissonnage automatique de ce site.
            </p>
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
              className="bg-blue-800 hover:bg-blue-900 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{website ? 'Mettre à jour' : 'Configurer'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}