import React from 'react';
import { Card, Col, Row, Typography, Alert, Spin } from 'antd';
import {
  BarChartOutlined,
  NotificationOutlined,
  BankOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  fetchContestStatistics,
  fetchSystemStatus,
} from '../../services/api';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ['contestStatistics'],
    queryFn: fetchContestStatistics,
    refetchInterval: 60000,
    retry: 1,
  });

  const { data: systemStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: fetchSystemStatus,
    refetchInterval: 30000,
    retry: 1,
  });

  if (statusLoading && !systemStatus) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const stats = statistics ?? null;
  const apiUnreachable = systemStatus?.api_status === 'unreachable';
  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        Dashboard
      </Title>
      {apiUnreachable && (
        <Alert
          type="warning"
          title="Backend no disponible"
          description="No se pudo conectar al servidor. Compruebe que la API esté en ejecución en el puerto configurado."
          style={{ marginBottom: 16 }}
        />
      )}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <BarChartOutlined style={{ fontSize: 32, color: '#1677ff' }} />
            <Title level={4} style={{ marginTop: 12 }}>
              {stats?.total_contests ?? 0}
            </Title>
            <Text type="secondary">Total de concursos</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <NotificationOutlined style={{ fontSize: 32, color: '#52c41a' }} />
            <Title level={4} style={{ marginTop: 12 }}>
              {stats?.active_contests ?? 0}
            </Title>
            <Text type="secondary">Concursos activos</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <BankOutlined style={{ fontSize: 32, color: '#faad14' }} />
            <Title level={4} style={{ marginTop: 12 }}>
              {stats?.total_schools ?? 0}
            </Title>
            <Text type="secondary">Escuelas</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <BookOutlined style={{ fontSize: 32, color: '#722ed1' }} />
            <Title level={4} style={{ marginTop: 12 }}>
              {stats?.total_subjects ?? 0}
            </Title>
            <Text type="secondary">Materias</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={12}>
          <Card title="Estado del sistema">
            <p>
              <Text strong>API:</Text>{' '}
              {systemStatus?.api_status ?? 'desconocido'}
            </p>
            <p>
              <Text strong>Base de datos:</Text>{' '}
              {systemStatus?.database ?? 'desconocido'}
            </p>
            <p>
              <Text strong>Scheduler:</Text>{' '}
              {systemStatus?.scheduler?.is_running ? 'En ejecución' : 'Detenido'}
            </p>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Fuentes disponibles">
            {systemStatus?.scheduler?.available_sources?.length ? (
              systemStatus.scheduler.available_sources.map((s: string) => (
                <p key={s}>• {s}</p>
              ))
            ) : (
              <Text type="secondary">Sin fuentes configuradas</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;

