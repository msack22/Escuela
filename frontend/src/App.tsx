import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, Alert, ConfigProvider, theme, Spin } from 'antd';
import esES from 'antd/locale/es_ES';
import { useQuery } from '@tanstack/react-query';
import { fetchSystemStatus } from './services/api';

import Navbar from './components/Navbar/Navbar';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const ContestList = lazy(() => import('./pages/ContestList/ContestList'));
const ScrapingControl = lazy(() => import('./pages/ScrapingControl/ScrapingControl'));
const AlertManagement = lazy(() => import('./pages/AlertManagement/AlertManagement'));
const UserManagement = lazy(() => import('./pages/UserManagement/UserManagement'));

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
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/contests" element={<ContestList />} />
              <Route path="/scraping" element={<ScrapingControl />} />
              <Route path="/alerts" element={<AlertManagement />} />
              <Route path="/users" element={<UserManagement />} />
            </Routes>
          </Suspense>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
