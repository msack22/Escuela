import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, Alert } from 'antd';
import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import { useQuery } from '@tanstack/react-query';
import { fetchSystemStatus } from './services/api';

import Navbar from './components/Navbar/Navbar';
import ContestList from './pages/ContestList/ContestList';
import AlertManagement from './pages/AlertManagement/AlertManagement';
import Dashboard from './pages/Dashboard/Dashboard';
import ScrapingStatus from './pages/ScrapingStatus/ScrapingStatus';
import CapacitacionesPage from './pages/Capacitaciones/CapacitacionesPage';
import UserManagement from './pages/UserManagement/UserManagement';
import SchedulerControl from './pages/SchedulerControl/SchedulerControl';

function App() {
  const { data: systemStatus } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: fetchSystemStatus,
    refetchInterval: 10000,
    retry: false,
  });
  const backendUnavailable = systemStatus?.api_status === 'unreachable';

  return (
    <ConfigProvider locale={esES}>
      <Layout style={{ minHeight: '100vh' }}>
        <Navbar />
        {backendUnavailable && (
          <Alert
            type="warning"
            showIcon
            title="Backend no disponible"
            description="No se puede conectar con el servidor. En una terminal ejecute: cd backend && python run.py"
            style={{ margin: '0 24px', marginTop: 16 }}
          />
        )}
        <Layout.Content style={{ padding: 24 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contests" element={<ContestList />} />
            <Route path="/scraping" element={<ScrapingStatus />} />
            <Route path="/alerts" element={<AlertManagement />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/scheduler" element={<SchedulerControl />} />
            <Route path="/capacitaciones" element={<CapacitacionesPage />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
