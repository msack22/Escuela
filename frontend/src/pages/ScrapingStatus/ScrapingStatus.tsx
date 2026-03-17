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
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchScrapingStatus,
  fetchScrapingLogs,
  runManualScraping,
  startScheduler,
  stopScheduler,
  fetchScrapingProgress,
} from '../../services/api';

const { Title, Text } = Typography;

const ScrapingStatus: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['scrapingStatus'],
    queryFn: fetchScrapingStatus,
    refetchInterval: 10000,
  });

  const { data: progress } = useQuery({
    queryKey: ['scrapingProgress'],
    queryFn: fetchScrapingProgress,
    refetchInterval: (status as any)?.is_running ? 2000 : false,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['scrapingLogs'],
    queryFn: () => fetchScrapingLogs(50),
  });

  const runMutation = useMutation({
    mutationFn: (sources?: string[]) =>
      runManualScraping(sources && sources.length ? sources : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrapingStatus'] });
      queryClient.invalidateQueries({ queryKey: ['scrapingLogs'] });
      queryClient.invalidateQueries({ queryKey: ['scrapingProgress'] });
    },
  });

  const startMutation = useMutation({
    mutationFn: startScheduler,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scrapingStatus'] }),
  });

  const stopMutation = useMutation({
    mutationFn: stopScheduler,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scrapingStatus'] }),
  });

  const logs = (logsData as any)?.logs ?? [];
  const st = (status as any) || {};
  const apiUnreachable = st.api_status === 'unreachable';
  const isRunning = runMutation.isPending || st.is_running || (progress as any)?.running;
  const progressData = progress as any;
  const availableSources: string[] = Array.isArray(st.available_sources) ? st.available_sources : [];
  const [selectedSources, setSelectedSources] = React.useState<string[]>([]);

  const logColumns = [
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
      render: (v: string) => (v ? <Tag color="blue">{v}</Tag> : '—'),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        if (v === 'success')
          return <Tag icon={<CheckCircleOutlined />} color="success">Éxito</Tag>;
        if (v === 'error')
          return <Tag icon={<CloseCircleOutlined />} color="error">Error</Tag>;
        return <Tag icon={<ClockCircleOutlined />}>{v || '—'}</Tag>;
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
    {
      title: 'Detalle',
      key: 'message',
      render: (_: any, r: any) => {
        const msg = r.error_message
          ? `Error: ${r.error_message}`
          : r.execution_time_seconds != null
            ? `Tiempo: ${r.execution_time_seconds.toFixed(1)}s`
            : '';
        return <Text type="secondary" style={{ fontSize: 12 }}>{msg || '—'}</Text>;
      },
    },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 24px' }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        Estado de scraping
      </Title>

      {apiUnreachable && (
        <Alert
          type="warning"
          showIcon
          title="Backend no disponible"
          description="No se pudo conectar al servidor. Compruebe que la API esté en ejecución."
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Banner cuando está ejecutando */}
      {isRunning && (
        <Card
          size="small"
          style={{
            marginBottom: 24,
            background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f7ff 100%)',
            border: '1px solid #91caff',
          }}
        >
          <Space align="center" size="middle" wrap>
            <Spin size="small" />
            <div>
              <Text strong style={{ display: 'block' }}>
                {progressData?.step || 'Ejecutando scraping...'}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Puede tardar 2–3 minutos según la cantidad de fuentes. No cierres esta página.
              </Text>
            </div>
            {typeof progressData?.percentage === 'number' && (
              <Progress
                percent={progressData.percentage}
                size="small"
                style={{ width: 120, marginBottom: 0 }}
              />
            )}
            {progressData?.items_found != null && (
              <Text type="secondary">{progressData.items_found} concursos encontrados</Text>
            )}
          </Space>
        </Card>
      )}

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card title="Acciones" loading={statusLoading}>
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

            <Space wrap size="middle">
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={runMutation.isPending}
                onClick={() =>
                  runMutation.mutate(
                    selectedSources.length ? selectedSources : undefined,
                  )
                }
              >
                Ejecutar scraping ahora
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
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['scrapingStatus'] });
                  queryClient.invalidateQueries({ queryKey: ['scrapingLogs'] });
                  queryClient.invalidateQueries({ queryKey: ['scrapingProgress'] });
                }}
              >
                Actualizar
              </Button>
            </Space>
          </Space>
        </Card>

        <Card title="Estado actual">
          {statusLoading ? (
            <Spin size="small" />
          ) : status ? (
            <Space size="middle" wrap>
              <Space>
                <Text type="secondary">Scheduler:</Text>
                <Tag color={st.is_running ? 'green' : 'default'}>
                  {st.is_running ? 'Activo' : 'Inactivo'}
                </Tag>
              </Space>
              {st.interval_hours != null && (
                <Space>
                  <Text type="secondary">Intervalo:</Text>
                  <Text>{st.interval_hours} h</Text>
                </Space>
              )}
              {Array.isArray(st.available_sources) && st.available_sources.length > 0 && (
                <Space>
                  <Text type="secondary">Fuentes:</Text>
                  <Text>{st.available_sources.length} disponibles</Text>
                </Space>
              )}
            </Space>
          ) : (
            <Text type="secondary">Sin datos</Text>
          )}
        </Card>

        <Card title="Últimos logs">
          <Table
            rowKey={(r: any, index: number) =>
              r.id ?? `${r.started_at ?? ''}-${r.source_name ?? ''}-${index}`
            }
            loading={logsLoading}
            columns={logColumns}
            dataSource={logs}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            size="small"
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Aún no hay registros de scraping. Ejecute el scraping para ver logs."
                />
              ),
            }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default ScrapingStatus;
