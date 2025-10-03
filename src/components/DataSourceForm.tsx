import React, { useState, useEffect } from 'react';
import { X, Save, Globe } from 'lucide-react';
import { DatabaseConstraintService } from '../services/databaseConstraintService';
import type { Database } from '../lib/database.types';

type DataSource = Database['public']['Tables']['data_sources']['Row'];

interface DataSourceFormProps {
  source?: DataSource;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

const DataSourceForm: React.FC<DataSourceFormProps> = ({ source, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    type: 'web',
    status: 'active',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nameValidation, setNameValidation] = useState<{
    isChecking: boolean;
    isValid: boolean;
    suggestion?: string;
  }>({ isChecking: false, isValid: true });

  useEffect(() => {
    if (source) {
      setFormData({
        name: source.name,
        url: source.url,
        type: source.type,
        status: source.status,
        description: source.description
      });
    }
  }, [source]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    } else if (!nameValidation.isValid) {
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

  // Valider l'unicité du nom en temps réel
  const validateNameUniqueness = async (name: string) => {
    if (!name.trim()) {
      setNameValidation({ isChecking: false, isValid: true });
      return;
    }

    setNameValidation({ isChecking: true, isValid: true });

    try {
      const validation = await DatabaseConstraintService.validateDataSourceName(
        name, 
        source?.id
      );
      
      setNameValidation({
        isChecking: false,
        isValid: validation.isValid,
        suggestion: validation.suggestion
      });

      if (!validation.isValid && validation.error) {
        setErrors(prev => ({ ...prev, name: validation.error }));
      }
    } catch (error) {
      console.error('Erreur lors de la validation du nom:', error);
      setNameValidation({ isChecking: false, isValid: true });
    }
  };

  // Debounce pour la validation du nom
  useEffect(() => {
    const timer = setTimeout(() => {
      validateNameUniqueness(formData.name);
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.name, source?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {source ? 'Modifier la source' : 'Nouvelle source de données'}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de la source *
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? 'border-red-300' : 
                  nameValidation.isValid ? 'border-gray-300' : 'border-orange-300'
                }`}
                placeholder="Ex: Site d'actualités"
              />
              {nameValidation.isChecking && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            {!nameValidation.isValid && nameValidation.suggestion && (
              <p className="text-orange-600 text-xs mt-1">
                💡 Suggestion: {nameValidation.suggestion}
              </p>
            )}
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
              Type de source
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="web">Site Web</option>
              <option value="api">API REST</option>
              <option value="rss">Flux RSS</option>
              <option value="json">JSON</option>
              <option value="xml">XML</option>
            </select>
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
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
              placeholder="Description optionnelle de la source..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{source ? 'Mettre à jour' : 'Créer'}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DataSourceForm;