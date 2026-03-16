import React, { useState } from 'react';
import { Table, Typography, Button, Input, Row, Col, Card, Spin, Alert, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCapacitaciones, scrapeCapacitaciones, fetchCapacitacionesStatistics } from '../../services/api';

const { Title, Text } = Typography;

const CapacitacionesPage: React.FC = () => {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const queryClient = useQueryClient();

  const { data: list, isLoading, error } = useQuery({
    queryKey: ['capacitaciones', filters],
    queryFn: () => fetchCapacitaciones({ limit: 100, ...filters }),
  });

  const { data: stats } = useQuery({
    queryKey: ['capacitacionesStats'],
    queryFn: fetchCapacitacionesStatistics,
  });

  const scrapeMutation = useMutation({
    mutationFn: scrapeCapacitaciones,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capacitaciones'] });
      queryClient.invalidateQueries({ queryKey: ['capacitacionesStats'] });
    },
  });

  const dataSource = Array.isArray(list) ? list : (list as any)?.items ?? [];
  const columns = [
    { title: 'Título', dataIndex: 'titulo', key: 'titulo' },
    { title: 'Institución', dataIndex: 'institucion', key: 'institucion' },
    { title: 'Modalidad', dataIndex: 'modalidad', key: 'modalidad' },
    { title: 'Ciudad', dataIndex: 'ciudad', key: 'ciudad' },
    { title: 'Fuente', dataIndex: 'fuente', key: 'fuente' },
  ];

  if (error) {
    return (
      <Alert
        type="error"
        title="Error al cargar capacitaciones"
        description={(error as Error)?.message}
      />
    );
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        Capacitaciones
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card size="small">
            <Text type="secondary">Total</Text>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{stats?.total ?? dataSource.length}</div>
          </Card>
        </Col>
        <Col xs={24} md={16} style={{ display: 'flex', alignItems: 'center' }}>
          <Space>
            <Input
              placeholder="Buscar por título"
              style={{ width: 200 }}
              onChange={(e) => setFilters((f) => ({ ...f, titulo: e.target.value || undefined }))}
            />
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={scrapeMutation.isPending}
              onClick={() => scrapeMutation.mutate()}
            >
              Actualizar desde fuente
            </Button>
          </Space>
        </Col>
      </Row>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={dataSource}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
};

export default CapacitacionesPage;
