import React, { useEffect, useState } from 'react';
import { Layout, Menu, Progress, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  OrderedListOutlined,
  NotificationOutlined,
  SettingOutlined,
  TeamOutlined,
  ScheduleOutlined,
  ReadOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../../services/api';
import type { ScrapingProgressResponse } from '../../services/api';

const { Header } = Layout;
const { Text } = Typography;

const DEFAULT_PROGRESS: ScrapingProgressResponse = {
  running: false,
  step: '',
  percentage: null,
  source: null,
};

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [progress, setProgress] = useState<ScrapingProgressResponse>(DEFAULT_PROGRESS);

  // Una sola conexión SSE: el backend envía el progreso cada 2 s; no hay polling desde el cliente
  useEffect(() => {
    const url = `${API_BASE_URL}/api/scraping/progress/stream`;
    const es = new EventSource(url);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as ScrapingProgressResponse;
        setProgress({ ...DEFAULT_PROGRESS, ...data });
      } catch {
        setProgress(DEFAULT_PROGRESS);
      }
    };
    es.onerror = () => {
      es.close();
      setProgress(DEFAULT_PROGRESS);
    };
    return () => {
      es.close();
    };
  }, []);

  const menuItems = [
    { label: 'Dashboard', icon: <DashboardOutlined />, path: '/' },
    { label: 'Concursos', icon: <OrderedListOutlined />, path: '/contests' },
    { label: 'Capacitaciones', icon: <ReadOutlined />, path: '/capacitaciones' },
    { label: 'Alertas', icon: <NotificationOutlined />, path: '/alerts' },
    { label: 'Usuarios', icon: <TeamOutlined />, path: '/users' },
    { label: 'Scheduler', icon: <ScheduleOutlined />, path: '/scheduler' },
    { label: 'Scraping', icon: <SettingOutlined />, path: '/scraping' },
  ];

  const selectedKeys = menuItems
    .filter(item => item.path === location.pathname)
    .map(item => item.path);

  const showProgressBar = progress?.running === true;

  return (
    <Header style={{ padding: 0, height: 64, position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 64,
          width: '100%',
        }}
      >
        <div style={{ color: '#fff', fontWeight: 600, marginRight: 24, flexShrink: 0 }}>
          Sistema de Concursos Educativos
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={selectedKeys}
          onClick={(info) => {
            const item = menuItems.find(m => m.path === info.key);
            if (item) navigate(item.path);
          }}
          items={menuItems.map(item => ({
            key: item.path,
            icon: item.icon,
            label: item.label,
          }))}
          style={{ flex: 1, minWidth: 0 }}
        />
        {/* Barra de progreso superpuesta a la derecha (no ocupa espacio, no rompe el menú) */}
        {showProgressBar && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 24,
              paddingRight: 24,
              maxWidth: 320,
              minWidth: 260,
              background: 'linear-gradient(to left, rgba(0,21,41,0.97) 0%, rgba(0,21,41,0.85) 70%, transparent 100%)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              <Space size="small" style={{ marginBottom: 2 }}>
                <LoadingOutlined style={{ color: '#69b1ff' }} />
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>
                  {progress?.step || 'Scraping...'}
                </Text>
                {typeof progress?.percentage === 'number' && (
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                    {progress.percentage}%
                  </Text>
                )}
                {progress?.items_found != null && (
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                    {progress.items_found} encontrados
                  </Text>
                )}
              </Space>
              <Progress
                percent={
                  typeof progress?.percentage === 'number'
                    ? progress.percentage
                    : undefined
                }
                status="active"
                showInfo={false}
                strokeColor="#69b1ff"
                style={{ marginBottom: 0 }}
              />
            </Space>
          </div>
        )}
      </div>
    </Header>
  );
};

export default Navbar;
