import React from 'react';
import { Database, Activity } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">MissanIa-Moisson</h1>
              <p className="text-sm text-gray-500">Système de Moissonnage de Données</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-green-600">Système Actif</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;