import React from 'react';
import {
  Card,
  Typography,
  Button,
  Table,
  Space,
  Alert,
  Spin,
  Tag,
  Progress,
  Empty,
  Select,
} from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchScrapingStatus,
  fetchScrapingLogs,
  fetchScrapingProgress,
  runManualScraping,
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  getSchedulerConfig,
  updateSchedulerConfig,
  getSchedulerHistory,
  SchedulerHistoryRun,
} from '../../services/api';

const { Title, Text } = Typography;

const ScrapingControl: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: scrapingStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['scrapingStatus'],
    queryFn: fetchScrapingStatus,
    refetchInterval: 10000,
  });

  const { data: scrapingProgress } = useQuery({
    queryKey: ['scrapingProgress'],
    queryFn: fetchScrapingProgress,
    refetchInterval: (scrapingStatus as any)?.is_running ? 2000 : false,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['scrapingLogs'],
    queryFn: () => fetchScrapingLogs(50),
  });

  const { data: schedulerStatus } = useQuery({
    queryKey: ['schedulerStatus-unified'],
    queryFn: getSchedulerStatus,
    refetchInterval: 15000,
  });

  const { data: schedulerConfig } = useQuery({
    queryKey: ['schedulerConfig-unified'],
    queryFn: getSchedulerConfig,
  });

  const { data: schedulerHistory } = useQuery({
    queryKey: ['schedulerHistory-unified'],
    queryFn: () => getSchedulerHistory(30),
    refetchInterval: 60000,
  });

  const [selectedSources, setSelectedSources] = React.useState<string[]>([]);
  const [configHours, setConfigHours] = React.useState<number[]>([8, 12, 16, 20]);
  const [configSources, setConfigSources] = React.useState<string[]>(['cge_simple', 'facebook_cge']);

  React.useEffect(() => {
    if (schedulerConfig) {
      setConfigHours(schedulerConfig.scheduled_hours ?? []);
      setConfigSources(schedulerConfig.auto_sources ?? []);
    }
  }, [schedulerConfig]);

  const runMutation = useMutation({
    mutationFn: (sources?: string[]) => runManualScraping(sources && sources.length ? sources : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrapingStatus'] });
      queryClient.invalidateQueries({ queryKey: ['scrapingLogs'] });
      queryClient.invalidateQueries({ queryKey: ['scrapingProgress'] });
    },
  });

  const startMutation = useMutation({
    mutationFn: startScheduler,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedulerStatus-unified'] }),
  });

  const stopMutation = useMutation({
    mutationFn: stopScheduler,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedulerStatus-unified'] }),
  });

  const updateConfigMutation = useMutation({
    mutationFn: () =>
      updateSchedulerConfig({
        scheduled_hours: configHours,
        auto_sources: configSources,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulerStatus-unified'] });
      queryClient.invalidateQueries({ queryKey: ['schedulerConfig-unified'] });
      queryClient.invalidateQueries({ queryKey: ['schedulerHistory-unified'] });
    },
  });

  const logs = (logsData as any)?.logs ?? [];
  const st = (scrapingStatus as any) || {};
  const apiUnreachable = st.api_status === 'unreachable';

  const progressData = scrapingProgress as any;
  const isRunning =
    runMutation.isPending || (!!progressData && progressData.running === true);

  const availableSources: string[] = Array.isArray(st.available_sources)
    ? st.available_sources
    : [];

  const hourOptions = Array.from({ length: 24 }, (_, h) => ({
    label: `${String(h).padStart(2, '0')}:00`,
    value: h,
  }));

  const manualLogColumns = [
    {
      title: 'Tipo',
      key: 'tipo',
      width: 90,
      render: () => <Tag color="geekblue">Manual</Tag>,
    },
    {
      title: 'Fecha',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      render: (v: string) => (v ? new Date(v).toLocaleString('es-AR') : '—'),
    },
    {
      title: 'Fuente',
      dataIndex: 'source_name',
      key: 'source_name',
      width: 140,
      render: (v: string) => (v ? <Tag>{v}</Tag> : '—'),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        if (v === 'success')
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              Éxito
            </Tag>
          );
        if (v === 'error')
          return (
            <Tag icon={<CloseCircleOutlined />} color="error">
              Error
            </Tag>
          );
        return (
          <Tag icon={<ClockCircleOutlined />}>
            {v || '—'}
          </Tag>
        );
      },
    },
    {
      title: 'Encontrados',
      dataIndex: 'contests_found',
      key: 'contests_found',
      width: 100,
      align: 'center' as const,
      render: (n: number) => (n != null ? n : '—'),
    },
  ];

  const schedulerColumns = [
    {
      title: 'Tipo',
      key: 'tipo',
      width: 90,
      render: () => <Tag color="purple">Automático</Tag>,
    },
    {
      title: 'Inicio (AR)',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      render: (v: string, row: SchedulerHistoryRun) =>
        v
          ? new Date(v).toLocaleString('es-AR', {
              timeZone: row.timezone,
              hour12: false,
            })
          : '—',
    },
    {
      title: 'Hora slot',
      dataIndex: 'hour_ar',
      key: 'hour_ar',
      width: 90,
      render: (h: number) => `${String(h).padStart(2, '0')}:00`,
    },
    {
      title: 'Fuentes',
      dataIndex: 'sources',
      key: 'sources',
      render: (sources: string[]) =>
        sources.map((s) => (
          <Tag key={s} icon={<SettingOutlined />}>
            {s}
          </Tag>
        )),
    },
    {
      title: 'Concursos totales',
      dataIndex: 'total_contests',
      key: 'total_contests',
      width: 130,
      align: 'center' as const,
    },
  ];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px 24px' }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        Scraping y Scheduler
      </Title>

      {apiUnreachable && (
        <Alert
          type="warning"
          showIcon
          message="Backend no disponible"
          description="No se pudo conectar al servidor. Compruebe que la API esté en ejecución."
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Estado actual */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {statusLoading ? (
            <Spin size="small" />
          ) : (
            <Space size="middle" wrap>
              <Space>
                <Text type="secondary">Scraping:</Text>
                <Tag color={isRunning ? 'green' : 'default'}>
                  {isRunning ? 'En ejecución' : 'Detenido'}
                </Tag>
              </Space>
              <Space>
                <Text type="secondary">Scheduler:</Text>
                <Tag color={schedulerStatus?.is_running ? 'green' : 'default'}>
                  {schedulerStatus?.is_running ? 'Activo' : 'Inactivo'}
                </Tag>
              </Space>
              {schedulerStatus?.next_run && (
                <Space>
                  <Text type="secondary">Próxima ejecución:</Text>
                  <Text>
                    {new Date(schedulerStatus.next_run).toLocaleString('es-AR', {
                      timeZone: schedulerStatus.timezone,
                      hour12: false,
                    })}
                  </Text>
                </Space>
              )}
            </Space>
          )}

          {isRunning && (
            <Space align="center" size="middle" wrap style={{ marginTop: 8 }}>
              <Spin size="small" />
              <Text strong>
                {progressData?.step || 'Ejecutando scraping...'}
              </Text>
              {typeof progressData?.percentage === 'number' && (
                <Progress
                  percent={progressData.percentage}
                  size="small"
                  style={{ width: 160, marginBottom: 0 }}
                />
              )}
            </Space>
          )}
        </Space>
      </Card>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Ejecución manual */}
        <Card title="Ejecución manual de scraping">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space align="center" wrap>
              <Text type="secondary">Fuentes para ejecutar (vacío = todas):</Text>
              <Select
                mode="multiple"
                allowClear
                placeholder={availableSources.length ? 'Todas las fuentes' : 'Sin fuentes disponibles'}
                style={{ minWidth: 260 }}
                disabled={isRunning || !availableSources.length}
                value={selectedSources}
                onChange={(values) => setSelectedSources(values)}
                options={availableSources.map((s) => ({ label: s, value: s }))}
              />
            </Space>

            <Space wrap>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={runMutation.isPending}
                disabled={isRunning}
                onClick={() =>
                  runMutation.mutate(selectedSources.length ? selectedSources : undefined)
                }
              >
                Ejecutar scraping ahora
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['scrapingStatus'] });
                  queryClient.invalidateQueries({ queryKey: ['scrapingLogs'] });
                  queryClient.invalidateQueries({ queryKey: ['scrapingProgress'] });
                  queryClient.invalidateQueries({ queryKey: ['schedulerStatus-unified'] });
                }}
              >
                Actualizar estado
              </Button>
            </Space>
          </Space>
        </Card>

        {/* Configuración de scheduler */}
        <Card title="Scheduler automático">
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
            <Space wrap>
              <Button
                type="primary"
                loading={updateConfigMutation.isPending}
                onClick={() => updateConfigMutation.mutate()}
              >
                Guardar configuración
              </Button>
              <Button
                icon={<PlayCircleOutlined />}
                loading={startMutation.isPending}
                onClick={() => startMutation.mutate()}
              >
                Iniciar scheduler
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                loading={stopMutation.isPending}
                onClick={() => stopMutation.mutate()}
              >
                Detener scheduler
              </Button>
            </Space>
          </Space>
        </Card>

        {/* Historial unificado */}
        <Card title="Historial de ejecuciones" style={{ marginTop: 8 }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Table
              rowKey={(r: any, index: number) =>
                r.id ?? `${r.started_at ?? ''}-${r.source_name ?? ''}-${index}`
              }
              loading={logsLoading}
              columns={manualLogColumns}
              dataSource={logs}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Aún no hay ejecuciones manuales."
                  />
                ),
              }}
            />

            <Table
              rowKey={(row: SchedulerHistoryRun) => row.started_at}
              loading={false}
              columns={schedulerColumns}
              dataSource={schedulerHistory?.runs ?? []}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Aún no hay ejecuciones automáticas del scheduler."
                  />
                ),
              }}
            />
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default ScrapingControl;
