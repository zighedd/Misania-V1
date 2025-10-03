import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const DatabaseTest: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [tableStatus, setTableStatus] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setConnectionStatus('testing');
    setErrorMessage('');
    setTableStatus({});

    if (!isSupabaseConfigured()) {
      setConnectionStatus('error');
      setErrorMessage('Variables d\'environnement Supabase manquantes. Vérifiez le fichier .env');
      return;
    }

    if (!supabase) {
      setConnectionStatus('error');
      setErrorMessage('Client Supabase Missan V3 non initialisé');
      return;
    }

    try {
      console.log('🔄 Test de connexion à Supabase...');
      
      // Test de connexion basique
      const { error } = await supabase.from('data_sources').select('count').limit(1);
      
      if (error) {
        console.error('❌ Erreur de connexion:', error);
        setConnectionStatus('error');
        if (error.code === 'PGRST205') {
          setErrorMessage('Les tables de la base de données n\'existent pas. Veuillez exécuter la migration de restauration.');
        } else {
          setErrorMessage(`Erreur de connexion: ${error.message}`);
        }
        return;
      }

      console.log('✅ Connexion Supabase réussie');
      
      // Test de l'existence des tables
      const tables = ['data_sources', 'harvesting_configs', 'harvest_results', 'harvest_logs'];
      const tableResults: Record<string, boolean> = {};

      for (const table of tables) {
        try {
          const { error: tableError } = await supabase.from(table).select('count').limit(1);
          tableResults[table] = !tableError;
          if (tableError) {
            console.warn(`⚠️ Table ${table}:`, tableError.message);
          } else {
            console.log(`✅ Table ${table}: OK`);
          }
        } catch {
          tableResults[table] = false;
          console.error(`❌ Table ${table}: Inaccessible`);
        }
      }

      setTableStatus(tableResults);
      setConnectionStatus('success');
      console.log('🎉 Test de connexion terminé avec succès');
    } catch (err) {
      setConnectionStatus('error');
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
      setErrorMessage(`Erreur inattendue: ${errorMsg}`);
      console.error('❌ Erreur inattendue:', err);
    }
  };

  const getStatusIcon = (status: 'testing' | 'success' | 'error') => {
    switch (status) {
      case 'testing':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <Database className="h-5 w-5 text-blue-600" />
          <h3 className="text-md font-medium text-gray-900">Test de Connexion Base de Données</h3>
          <div className="flex items-center space-x-2">
            {getStatusIcon(connectionStatus)}
            <span className={`text-xs font-medium ${
              connectionStatus === 'success' ? 'text-green-600' : 
              connectionStatus === 'error' ? 'text-red-600' : 'text-blue-600'
            }`}>
              {connectionStatus === 'testing' ? 'Test en cours...' :
               connectionStatus === 'success' ? 'Connecté' : 'Erreur'}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-gray-100">
          {/* Message d'erreur */}
          {connectionStatus === 'error' && errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-red-700 text-sm">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Statut des tables */}
          {connectionStatus === 'success' && Object.keys(tableStatus).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Tables de la base de données :</h4>
              <div className="space-y-2">
                {Object.entries(tableStatus).map(([table, exists]) => (
                  <div key={table} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">{table}</span>
                    <div className="flex items-center space-x-1">
                      {exists ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`text-xs ${exists ? 'text-green-600' : 'text-red-600'}`}>
                        {exists ? 'Existe' : 'Manquante'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bouton de nouveau test */}
          <button
            onClick={testConnection}
            disabled={connectionStatus === 'testing'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-2 rounded-lg transition-colors text-sm"
          >
            {connectionStatus === 'testing' ? 'Test en cours...' : 'Tester à nouveau'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DatabaseTest;