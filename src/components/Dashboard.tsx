import React, { useState, useEffect } from 'react';
import WebsiteManager from './WebsiteManager';
import DatabaseTest from './DatabaseTest';
import SystemHealthCheck from './SystemHealthCheck';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <SystemHealthCheck />
      <DatabaseTest />
      <WebsiteManager />
    </div>
  );
};

export default Dashboard;