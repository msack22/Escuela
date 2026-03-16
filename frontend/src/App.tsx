import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, Alert, ConfigProvider, theme } from 'antd';
import esES from 'antd/locale/es_ES';
import { useQuery } from '@tanstack/react-query';
import { fetchSystemStatus } from './services/api';

import Navbar from './components/Navbar/Navbar';
import ContestList from './pages/ContestList/ContestList';
import AlertManagement from './pages/AlertManagement/AlertManagement';
import Dashboard from './pages/Dashboard/Dashboard';
import ScrapingControl from './pages/ScrapingControl/ScrapingControl';
// import CapacitacionesPage from './pages/Capacitaciones/CapacitacionesPage';
import UserManagement from './pages/UserManagement/UserManagement';

function App() {
  const { data: systemStatus } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: fetchSystemStatus,
    refetchInterval: 10000,
    retry: false,
  });
  const backendUnavailable = systemStatus?.api_status === 'unreachable';

  return (
    <ConfigProvider
      locale={esES}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorBgBase: '#111827',
          colorBgContainer: '#111827',
          colorTextBase: '#e5e7eb',
          colorBorderSecondary: '#1f2937',
          colorPrimary: '#9ca3af',
          colorLink: '#e5e7eb',
          colorLinkHover: '#f9fafb',
        },
      }}
    >
      <Layout style={{ minHeight: '100vh', background: '#111827' }}>
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
        <Layout.Content style={{ padding: 24, background: '#111827' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contests" element={<ContestList />} />
            <Route path="/scraping" element={<ScrapingControl />} />
            <Route path="/alerts" element={<AlertManagement />} />
            <Route path="/users" element={<UserManagement />} />
            {/* <Route path="/capacitaciones" element={<CapacitacionesPage />} /> */}
          </Routes>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
