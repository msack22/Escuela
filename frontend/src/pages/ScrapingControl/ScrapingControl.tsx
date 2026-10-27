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
  Modal,
  List,
} from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  RightOutlined,
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
  getSchedulerRunDiscarded,
  SchedulerHistoryRun,
} from '../../services/api';

const { Title, Text } = Typography;

function discardReasonLabel(reason: string): string {
  switch (reason) {
    case 'level_keyword':
      return 'Descartado por palabra clave de nivel (posible falso positivo)';
    case 'duplicate_url':
      return 'Ya existía (duplicado por URL)';
    default:
      return reason;
  }
}

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

  const [discardedRunId, setDiscardedRunId] = React.useState<number | null>(null);
  const { data: discardedBreakdown, isLoading: discardedLoading } = useQuery({
    queryKey: ['schedulerRunDiscarded', discardedRunId],
    queryFn: () => getSchedulerRunDiscarded(discardedRunId as number),
    enabled: discardedRunId != null,
  });

  const [selectedSources, setSelectedSources] = React.useState<string[]>([]);
  const [sendNotifications, setSendNotifications] = React.useState<boolean>(true);
  const [configHours, setConfigHours] = React.useState<number[]>([8, 12, 16, 20]);
  const [configSources, setConfigSources] = React.useState<string[]>(['cge_simple', 'facebook_cge']);

  React.useEffect(() => {
    if (schedulerConfig) {
      setConfigHours(schedulerConfig.scheduled_hours ?? []);
      setConfigSources(schedulerConfig.auto_sources ?? []);
    }
  }, [schedulerConfig]);

  const runMutation = useMutation({
    mutationFn: (params: { sources?: string[]; send_notifications?: boolean }) =>
      runManualScraping(params.sources && params.sources.length ? params.sources : undefined, {
        send_notifications: params.send_notifications,
      }),
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
      title: 'Traídos (API)',
      dataIndex: 'fetched_total',
      key: 'fetched_total',
      width: 110,
      align: 'center' as const,
      render: (v: number) => (
        <span style={{ color: '#1677ff' }} title="Total que devolvió la API (sin filtrar)">
          {v ?? 0}
        </span>
      ),
    },
    {
      title: 'Guardados',
      dataIndex: 'total_contests',
      key: 'total_contests',
      width: 100,
      align: 'center' as const,
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#52c41a' : '#888' }}>
          {v > 0 ? `+${v}` : '0'}
        </span>
      ),
    },
    {
      title: 'Filtrados',
      key: 'filtrados',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, row: SchedulerHistoryRun) => {
        const filtered = (row.fetched_total ?? 0) - (row.total_contests ?? 0);
        return (
          <span
            style={{ color: filtered > 0 ? '#faad14' : '#888' }}
            title="Solo cuenta duplicados por URL. Los descartes por palabra clave de nivel no entran acá — tocá la fila para ver el detalle completo."
          >
            {filtered > 0 ? filtered : '0'}
          </span>
        );
      },
    },
    {
      title: '',
      key: 'detalle',
      width: 40,
      align: 'center' as const,
      render: () => <RightOutlined style={{ color: '#999' }} />,
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
          title="Backend no disponible"
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
            <Space align="center" wrap>
              <Text type="secondary">Enviar notificaciones al finalizar:</Text>
              <Select
                style={{ width: 180 }}
                value={sendNotifications ? 'yes' : 'no'}
                onChange={(value) => setSendNotifications(value === 'yes')}
                disabled={isRunning}
                options={[
                  { value: 'yes', label: 'Sí, enviar' },
                  { value: 'no', label: 'No enviar' },
                ]}
              />
            </Space>

            <Space wrap>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={runMutation.isPending}
                disabled={isRunning}
                onClick={() =>
                  runMutation.mutate({
                    sources: selectedSources.length ? selectedSources : undefined,
                    send_notifications: sendNotifications,
                  })
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
              rowKey={(row: SchedulerHistoryRun) => row.id}
              loading={false}
              columns={schedulerColumns}
              dataSource={schedulerHistory?.runs ?? []}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              size="small"
              onRow={(row: SchedulerHistoryRun) => ({
                onClick: () => setDiscardedRunId(row.id),
                style: { cursor: 'pointer' },
              })}
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

          <Modal
            title="Detalle de filtros de la corrida"
            open={discardedRunId != null}
            onCancel={() => setDiscardedRunId(null)}
            footer={[
              <Button key="close" onClick={() => setDiscardedRunId(null)}>
                Cerrar
              </Button>,
            ]}
            width={720}
          >
            {discardedLoading && <Spin />}
            {discardedBreakdown && (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  message="Categorías excluidas por diseño (nunca se piden a la API)"
                  description={discardedBreakdown.excluded_levels.join(', ') || 'Ninguna'}
                />
                {discardedBreakdown.groups.length === 0 && (
                  <Empty description="No se descartó ningún concurso individual en esta corrida." />
                )}
                {discardedBreakdown.groups.map((g) => (
                  <Card key={g.reason} size="small" title={`${discardReasonLabel(g.reason)} (${g.count})`}>
                    <List
                      size="small"
                      dataSource={g.items}
                      renderItem={(item) => (
                        <List.Item>
                          <Space direction="vertical" size={0} style={{ width: '100%' }}>
                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                              {item.title || item.url}
                            </a>
                            {item.keyword_matched && <Tag color="orange">keyword: {item.keyword_matched}</Tag>}
                          </Space>
                        </List.Item>
                      )}
                    />
                  </Card>
                ))}
              </Space>
            )}
          </Modal>
        </Card>
      </Space>
    </div>
  );
};

export default ScrapingControl;
