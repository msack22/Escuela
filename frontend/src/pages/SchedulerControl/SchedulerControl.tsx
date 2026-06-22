import React from 'react';
import { Card, Typography, Button, Space, Alert, Descriptions, Select, Table, Tag, Statistic, Row, Col, Spin } from 'antd';
import { PlayCircleOutlined, StopOutlined, ThunderboltOutlined, ReloadOutlined, DatabaseOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSchedulerStatus,
  restartScheduler,
  runScrapingOnce,
  getSchedulerConfig,
  updateSchedulerConfig,
  getSchedulerHistory,
  SchedulerHistoryRun,
  fetchContests,
} from '../../services/api';

const { Title, Text } = Typography;

const SchedulerControl: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: schedulerStatus, isLoading } = useQuery({
    queryKey: ['schedulerStatus'],
    queryFn: getSchedulerStatus,
    refetchInterval: 15000,
    retry: 1,
  });

  const [selectedSources, setSelectedSources] = React.useState<string[]>([]);
  const [configHours, setConfigHours] = React.useState<number[]>([8, 12, 16, 20]);
  const [configSources, setConfigSources] = React.useState<string[]>(['cge_simple', 'facebook_cge']);
  const [cgeHealth, setCgeHealth] = React.useState<{ ok: boolean; posts_sample_count: number; sample: any[]; error?: string; checked_at: string } | null>(null);
  const [cgeHealthLoading, setCgeHealthLoading] = React.useState(false);

  const { data: schedulerConfig } = useQuery({
    queryKey: ['schedulerConfig'],
    queryFn: getSchedulerConfig,
  });

  const { data: schedulerHistory } = useQuery({
    queryKey: ['schedulerHistory'],
    queryFn: () => getSchedulerHistory(20),
    refetchInterval: 60000,
  });

  const { data: contestsData } = useQuery({
    queryKey: ['contestsTotal'],
    queryFn: () => fetchContests({ page: 1, limit: 1 }),
    refetchInterval: 60000,
  });

  React.useEffect(() => {
    if (schedulerConfig) {
      setConfigHours(schedulerConfig.scheduled_hours ?? []);
      setConfigSources(schedulerConfig.auto_sources ?? []);
    }
  }, [schedulerConfig]);

  const runOnceMutation = useMutation({
    mutationFn: () =>
      runScrapingOnce(
        selectedSources.length ? { sources: selectedSources } : {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulerStatus'] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: restartScheduler,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedulerStatus'] }),
  });

  const updateConfigMutation = useMutation({
    mutationFn: () =>
      updateSchedulerConfig({
        scheduled_hours: configHours,
        auto_sources: configSources,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulerStatus'] });
      queryClient.invalidateQueries({ queryKey: ['schedulerConfig'] });
    },
  });

  const apiUnreachable = (schedulerStatus as any)?.api_status === 'unreachable';
  const availableSources: string[] = Array.isArray((schedulerStatus as any)?.available_sources)
    ? (schedulerStatus as any).available_sources
    : [];

  const hourOptions = Array.from({ length: 24 }, (_, h) => ({
    label: `${String(h).padStart(2, '0')}:00`,
    value: h,
  }));

  const historyColumns = [
    {
      title: 'Inicio (AR)',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (value: string, row: SchedulerHistoryRun) =>
        new Date(value).toLocaleString('es-AR', {
          timeZone: row.timezone,
          hour12: false,
        }),
    },
    {
      title: 'Hora AR',
      dataIndex: 'hour_ar',
      key: 'hour_ar',
      render: (h: number) => `${String(h).padStart(2, '0')}:00`,
    },
    {
      title: 'Fuentes',
      dataIndex: 'sources',
      key: 'sources',
      render: (sources: string[]) =>
        sources.map((s) => (
          <Tag key={s} color={s.includes('facebook') ? 'geekblue' : 'green'}>
            {s}
          </Tag>
        )),
    },
    {
      title: 'Encontrados (API)',
      dataIndex: 'fetched_total',
      key: 'fetched_total',
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#1677ff' : '#888' }} title="Total de concursos que devolvió la CGE API (cualquier departamento)">
          {v ?? 0}
        </span>
      ),
    },
    {
      title: 'Nuevos guardados',
      dataIndex: 'total_contests',
      key: 'total_contests',
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#52c41a' : '#888' }}>
          {v > 0 ? `+${v}` : '0'}
        </span>
      ),
    },
    {
      title: 'CGE',
      dataIndex: 'cgeCount',
      key: 'cgeCount',
    },
    {
      title: 'Facebook',
      dataIndex: 'facebookCount',
      key: 'facebookCount',
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        Control del Scheduler
      </Title>
      {apiUnreachable && (
        <Alert
          type="warning"
          title="Backend no disponible"
          description="No se pudo conectar al servidor. Compruebe que la API esté en ejecución."
          style={{ marginBottom: 16 }}
        />
      )}
      <Card loading={isLoading}>
        <Descriptions title="Estado" column={1} bordered size="small">
          <Descriptions.Item label="En ejecución">
            {schedulerStatus?.is_running ? (
              <Text type="success">Sí</Text>
            ) : (
              <Text type="secondary">No</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Última ejecución">
            {schedulerStatus?.last_run ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Próxima ejecución">
            {schedulerStatus?.next_run ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Zona horaria">
            {(schedulerStatus as any)?.timezone ?? 'America/Argentina/Buenos_Aires'}
          </Descriptions.Item>
          <Descriptions.Item label="Jobs activos">
            {schedulerStatus?.job_count ?? 0}
          </Descriptions.Item>
          <Descriptions.Item label="Horarios automáticos (AR)">
            {(schedulerStatus as any)?.scheduled_hours?.length
              ? (schedulerStatus as any).scheduled_hours
                  .map((h: number) => `${String(h).padStart(2, '0')}:00`)
                  .join(', ')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Fuentes automáticas">
            {(schedulerStatus as any)?.auto_sources?.length
              ? (schedulerStatus as any).auto_sources.join(', ')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Fuentes disponibles">
            {availableSources.length > 0 ? availableSources.join(', ') : 'Ninguna'}
          </Descriptions.Item>
        </Descriptions>

        <Space direction="vertical" style={{ marginTop: 16, width: '100%' }} size="middle">
          <Space align="center" wrap>
            <Text type="secondary">Fuentes para ejecutar (vacío = todas):</Text>
            <Select
              mode="multiple"
              allowClear
              placeholder={availableSources.length ? 'Todas las fuentes' : 'Sin fuentes disponibles'}
              style={{ minWidth: 260 }}
              disabled={runOnceMutation.isPending || !availableSources.length}
              value={selectedSources}
              onChange={(values) => setSelectedSources(values)}
              options={availableSources.map((s) => ({ label: s, value: s }))}
            />
          </Space>

          <Card size="small" title="Configuración automática" style={{ marginTop: 8 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Space align="center" wrap style={{ width: '100%' }}>
                <Text type="secondary">Horarios (hora Argentina):</Text>
                <Select
                  mode="multiple"
                  style={{ minWidth: 260 }}
                  value={configHours}
                  onChange={(values) => setConfigHours(values as number[])}
                  options={hourOptions}
                  placeholder="Seleccionar horas"
                />
              </Space>
              <Space align="center" wrap style={{ width: '100%' }}>
                <Text type="secondary">Fuentes automáticas:</Text>
                <Select
                  mode="multiple"
                  allowClear
                  style={{ minWidth: 260 }}
                  value={configSources}
                  onChange={(values) => setConfigSources(values as string[])}
                  options={availableSources.map((s) => ({ label: s, value: s }))}
                  placeholder="Seleccionar fuentes"
                />
              </Space>
              <Button
                type="primary"
                loading={updateConfigMutation.isPending}
                onClick={() => updateConfigMutation.mutate()}
              >
                Guardar configuración
              </Button>
            </Space>
          </Card>

          <Space wrap>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={runOnceMutation.isPending}
            onClick={() => runOnceMutation.mutate()}
          >
            Ejecutar una vez
          </Button>
          <Button
            icon={<ReloadOutlined />}
            loading={restartMutation.isPending}
            onClick={() => restartMutation.mutate()}
          >
            Reiniciar scheduler
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['schedulerStatus'] })}
          >
            Actualizar estado
          </Button>
          </Space>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginTop: 24, marginBottom: 8 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total concursos en BD"
              value={contestsData?.total ?? '...'}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Nuevos (último run)"
              value={schedulerHistory?.runs?.[0]?.total_contests ?? 0}
              valueStyle={{ color: (schedulerHistory?.runs?.[0]?.total_contests ?? 0) > 0 ? '#52c41a' : '#888' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Runs hoy"
              value={schedulerHistory?.runs?.filter(r =>
                new Date(r.started_at).toDateString() === new Date().toDateString()
              ).length ?? 0}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Historial de ejecuciones automáticas" style={{ marginTop: 8 }}>
        <Table
          size="small"
          rowKey={(row) => row.started_at}
          dataSource={[...(schedulerHistory?.runs ?? [])].sort(
            (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
          )}
          columns={historyColumns}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default SchedulerControl;
