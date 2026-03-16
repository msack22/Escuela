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
    // { label: 'Capacitaciones', icon: <ReadOutlined />, path: '/capacitaciones' },
    { label: 'Alertas', icon: <NotificationOutlined />, path: '/alerts' },
    { label: 'Usuarios', icon: <TeamOutlined />, path: '/users' },
    { label: 'Scraping', icon: <SettingOutlined />, path: '/scraping' },
  ];

  const selectedKeys = menuItems
    .filter(item => item.path === location.pathname)
    .map(item => item.path);

  const showProgressBar = progress?.running === true;

  return (
    <Header style={{ padding: 0, height: 64, lineHeight: '64px', background: '#030712' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 64,
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
          style={{ flex: 1, minWidth: 0, borderBottom: 'none' }}
        />
        {showProgressBar && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 24px',
              height: '100%',
              flexShrink: 0,
              gap: 8,
            }}
          >
            <Space direction="vertical" size={2}>
              <Space size="small">
                <LoadingOutlined style={{ color: '#69b1ff' }} />
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 500 }}>
                  {progress.step || 'Scraping en progreso...'}
                </Text>
              </Space>
              {typeof progress.percentage === 'number' && (
                <Progress
                  percent={progress.percentage}
                  size="small"
                  showInfo
                  strokeColor="#69b1ff"
                  style={{ marginBottom: 0, minWidth: 160 }}
                />
              )}
            </Space>
          </div>
        )}
      </div>
    </Header>
  );
};

export default Navbar;
