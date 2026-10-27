import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, Alert, ConfigProvider, theme, Spin } from 'antd';
import esES from 'antd/locale/es_ES';
import { useQuery } from '@tanstack/react-query';
import { fetchSystemStatus, fetchWhatsappStatus } from './services/api';

import Navbar from './components/Navbar/Navbar';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const ContestList = lazy(() => import('./pages/ContestList/ContestList'));
const ScrapingControl = lazy(() => import('./pages/ScrapingControl/ScrapingControl'));
const AlertManagement = lazy(() => import('./pages/AlertManagement/AlertManagement'));
const UserManagement = lazy(() => import('./pages/UserManagement/UserManagement'));
const PadronEscuelas = lazy(() => import('./pages/PadronEscuelas/PadronEscuelas'));
const SubjectManagement = lazy(() => import('./pages/SubjectManagement/SubjectManagement'));
const LowConfidence = lazy(() => import('./pages/LowConfidence/LowConfidence'));
const Subscribe = lazy(() => import('./pages/Subscribe/Subscribe'));

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: systemStatus } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: fetchSystemStatus,
    refetchInterval: 10000,
    retry: false,
  });
  const backendUnavailable = systemStatus?.api_status === 'unreachable';

  const { data: waStatus } = useQuery({
    queryKey: ['waStatus'],
    queryFn: fetchWhatsappStatus,
    refetchInterval: 30000,
    retry: false,
  });
  const waDown = waStatus?.ready === false;

  return (
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
      {waDown && !backendUnavailable && (
        <Alert
          type="error"
          showIcon
          message="WhatsApp desconectado"
          description={
            <span>
              El servicio de WhatsApp no está activo. Las notificaciones por WhatsApp no se enviarán hasta que se reconecte.{' '}
              Escaneá el QR ejecutando:{' '}
              <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.15)', padding: '1px 5px', borderRadius: 3 }}>
                pm2 logs whatsapp-service
              </code>
            </span>
          }
          style={{ margin: '0 24px', marginTop: 16 }}
        />
      )}
      <Layout.Content style={{ padding: 24, background: '#111827' }}>
        {children}
      </Layout.Content>
    </Layout>
  );
}

function App() {
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
      <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>}>
        <Routes>
          <Route path="/suscribirse" element={<Subscribe />} />
          <Route
            path="/*"
            element={
              <AdminLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/contests" element={<ContestList />} />
                  <Route path="/scraping" element={<ScrapingControl />} />
                  <Route path="/alerts" element={<AlertManagement />} />
                  <Route path="/users" element={<UserManagement />} />
                  <Route path="/padron" element={<PadronEscuelas />} />
                  <Route path="/subjects" element={<SubjectManagement />} />
                  <Route path="/low-confidence" element={<LowConfidence />} />
                </Routes>
              </AdminLayout>
            }
          />
        </Routes>
      </Suspense>
    </ConfigProvider>
  );
}

export default App;
