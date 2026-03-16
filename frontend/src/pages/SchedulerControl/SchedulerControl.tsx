import React from 'react';
import { Card, Typography, Button, Space, Alert, Spin, Descriptions } from 'antd';
import { PlayCircleOutlined, StopOutlined, ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSchedulerStatus,
  restartScheduler,
  runScrapingOnce,
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

  const runOnceMutation = useMutation({
    mutationFn: () => runScrapingOnce({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulerStatus'] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: restartScheduler,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedulerStatus'] }),
  });

  const apiUnreachable = (schedulerStatus as any)?.api_status === 'unreachable';

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
          <Descriptions.Item label="Jobs activos">
            {schedulerStatus?.job_count ?? 0}
          </Descriptions.Item>
          <Descriptions.Item label="Fuentes disponibles">
            {Array.isArray(schedulerStatus?.available_sources) &&
            schedulerStatus.available_sources.length > 0
              ? schedulerStatus.available_sources.join(', ')
              : 'Ninguna'}
          </Descriptions.Item>
        </Descriptions>

        <Space style={{ marginTop: 16 }} wrap>
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
      </Card>
    </div>
  );
};

export default SchedulerControl;
