import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Settings } from 'lucide-react';

interface HealthStatus {
  supabase: {
    configured: boolean;
    url: boolean;
    key: boolean;
  };
  openai: {
    configured: boolean;
    apiKey: boolean;
    promptId: boolean;
  };
  overall: 'healthy' | 'warning' | 'error';
}

const SystemHealthCheck: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    checkSystemHealth();
  }, []);

  const checkSystemHealth = () => {
    console.log('🔍 Vérification de la santé du système...');
    
    // Vérification Supabase (existant)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    // Vérification OpenAI (nouveau)
    const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
    const openaiPromptId = import.meta.env.VITE_OPENAI_PROMPT_ID;
    
    const supabaseStatus = {
      configured: !!(supabaseUrl && supabaseKey),
      url: !!supabaseUrl,
      key: !!supabaseKey
    };
    
    const openaiStatus = {
      configured: !!(openaiKey && openaiPromptId),
      apiKey: !!openaiKey,
      promptId: !!openaiPromptId
    };
    
    let overall: 'healthy' | 'warning' | 'error' = 'healthy';
    
    if (!supabaseStatus.configured) {
      overall = 'error';
    } else if (!openaiStatus.configured) {
      overall = 'warning';
    }
    
    const status: HealthStatus = {
      supabase: supabaseStatus,
      openai: openaiStatus,
      overall
    };
    
    setHealthStatus(status);
    
    console.log('✅ Diagnostic système terminé:', status);
  };

  const getStatusIcon = (isOk: boolean) => {
    return isOk ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getOverallIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Settings className="h-5 w-5 text-gray-500" />;
    }
  };

  const getOverallMessage = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'Système opérationnel - Toutes les fonctionnalités disponibles';
      case 'warning':
        return 'Système partiellement opérationnel - Moissonnage OpenAI indisponible';
      case 'error':
        return 'Configuration requise - Supabase non configuré';
      default:
        return 'Vérification en cours...';
    }
  };

  if (!healthStatus) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Vérification du système...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          {getOverallIcon(healthStatus.overall)}
          <div>
            <h3 className="text-md font-medium text-gray-900">État du Système</h3>
            <p className="text-sm text-gray-600">{getOverallMessage(healthStatus.overall)}</p>
          </div>
        </div>
        <Settings className={`h-4 w-4 text-gray-500 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Statut Supabase */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">Base de Données (Supabase)</h4>
              {getStatusIcon(healthStatus.supabase.configured)}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">URL configurée</span>
                {getStatusIcon(healthStatus.supabase.url)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Clé d'accès configurée</span>
                {getStatusIcon(healthStatus.supabase.key)}
              </div>
            </div>
          </div>

          {/* Statut OpenAI */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">Moissonnage IA (OpenAI)</h4>
              {getStatusIcon(healthStatus.openai.configured)}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Clé API configurée</span>
                {getStatusIcon(healthStatus.openai.apiKey)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">ID Prompt configuré</span>
                {getStatusIcon(healthStatus.openai.promptId)}
              </div>
            </div>
          </div>

          {/* Messages d'aide */}
          {healthStatus.overall !== 'healthy' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h5 className="text-sm font-medium text-blue-800 mb-2">Actions requises :</h5>
              <ul className="text-xs text-blue-700 space-y-1">
                {!healthStatus.supabase.configured && (
                  <li>• Cliquez sur "Connect to Supabase" en haut à droite</li>
                )}
                {!healthStatus.openai.configured && (
                  <li>• Ajoutez les variables OpenAI dans votre fichier .env</li>
                )}
              </ul>
            </div>
          )}

          <button
            onClick={checkSystemHealth}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors text-sm"
          >
            Actualiser le diagnostic
          </button>
        </div>
      )}
    </div>
  );
};

export default SystemHealthCheck;