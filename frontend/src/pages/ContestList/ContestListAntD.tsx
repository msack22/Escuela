import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Table, 
  Input, 
  Button, 
  Select, 
  DatePicker, 
  Space, 
  Tag, 
  Tooltip, 
  Pagination, 
  Row, 
  Col, 
  Badge, 
  Avatar,
  Divider,
  Empty,
  Spin,
  message,
  Drawer,
  Descriptions,
  Alert
} from 'antd';
import {
  SearchOutlined,
  ClearOutlined,
  RedoOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  InfoCircleOutlined,
  GlobalOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FilterOutlined,
  ExportOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

import {
  fetchContests,
  fetchSchools,
  fetchSubjects,
  fetchLevels,
  fetchShifts,
  fetchContractTypes,
  fetchCities,
  fetchDepartments,
} from '../../services/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;

// Configurar dayjs en español
dayjs.locale('es');

interface Contest {
  id: number;
  title: string;
  description: string;
  date: string;
  registration_deadline: string;
  publication_date: string;
  school: {
    id: number;
    name: string;
    city: string;
    department: string;
  };
  subject: {
    id: number;
    name: string;
  };
  source: {
    name: string;
    url: string;
  };
  is_active: boolean;
  level?: string;
  shift?: string;
  hours_to_cover?: number;
  contract_type?: string;
}

const ContestListAntD: React.FC = () => {
  const [filters, setFilters] = useState({
    title_contains: '',
    subject_ids: [],
    cities: [],
    departments: [],
    date_from: null as dayjs.Dayjs | null,
    date_to: null as dayjs.Dayjs | null,
    is_active: true,
  });

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);

  const {
    data: contestsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['contests', filters, current, pageSize],
    queryFn: () => fetchContests({
      ...filters,
      date_from: filters.date_from?.format('YYYY-MM-DD') || '',
      date_to: filters.date_to?.format('YYYY-MM-DD') || '',
      skip: (current - 1) * pageSize,
      limit: pageSize,
    }),
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  const { data: citiesData } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  const handleFilterChange = (field: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
    setCurrent(1); // Reset to first page
  };

  const handleClearFilters = () => {
    setFilters({
      title_contains: '',
      subject_ids: [],
      cities: [],
      departments: [],
      date_from: null,
      date_to: null,
      is_active: true,
    });
    setCurrent(1);
  };

  const handleLastWeekFilter = () => {
    const today = dayjs();
    const oneWeekAgo = today.subtract(7, 'day');
    
    setFilters(prev => ({
      ...prev,
      date_from: oneWeekAgo,
      date_to: today,
    }));
    setCurrent(1);
  };

  const handleSearch = () => {
    refetch();
  };

  const handleViewDetails = (contest: Contest) => {
    setSelectedContest(contest);
    setDrawerVisible(true);
  };

  const handleExport = () => {
    message.info('Función de exportación próximamente disponible');
  };

  const columns = [
    {
      title: 'Título del Concurso',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      ellipsis: true,
      render: (title: string, record: Contest) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>{title}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.school.name}
          </Text>
        </div>
      ),
    },
    {
      title: 'Materia',
      dataIndex: ['subject', 'name'],
      key: 'subject',
      width: 150,
      render: (subject: string) => (
        <Tag color="blue" style={{ fontSize: '12px' }}>
          {subject}
        </Tag>
      ),
    },
    {
      title: 'Ubicación',
      key: 'location',
      width: 180,
      render: (record: Contest) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <EnvironmentOutlined style={{ color: '#52c41a', fontSize: '12px' }} />
            <Text style={{ fontSize: '12px' }}>{record.school.city}</Text>
          </div>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {record.school.department}
          </Text>
        </div>
      ),
    },
    {
      title: 'Fechas',
      key: 'dates',
      width: 200,
      render: (record: Contest) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
            <CalendarOutlined style={{ color: '#1890ff', fontSize: '12px' }} />
            <Text style={{ fontSize: '12px' }}>
              {record.date ? dayjs(record.date).format('DD/MM/YYYY HH:mm') : 'N/A'}
            </Text>
          </div>
          {record.registration_deadline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ClockCircleOutlined style={{ color: '#fa8c16', fontSize: '12px' }} />
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Cierre: {dayjs(record.registration_deadline).format('DD/MM/YYYY')}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Fuente',
      dataIndex: 'source.name',
      key: 'source',
      width: 120,
      render: (source: string, record: Contest) => (
        <Button
          type="text"
          size="small"
          icon={<GlobalOutlined />}
          onClick={() => {
            if (record.source?.url && record.source.url.trim() !== '') {
              window.open(record.source.url, '_blank');
            } else {
              message.warning('No hay enlace disponible para esta fuente');
            }
          }}
          style={{ 
            fontSize: '12px',
            color: source === 'Facebook' ? '#1890ff' : '#722ed1'
          }}
        >
          {source}
        </Button>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      render: (record: Contest) => (
        <Space>
          <Tooltip title="Ver detalles">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
              style={{ color: '#1890ff' }}
            />
          </Tooltip>
          <Tooltip title="Ver fuente original">
            <Button
              type="text"
              icon={<LinkOutlined />}
              onClick={() => {
                if (record.source?.url && record.source.url.trim() !== '') {
                  window.open(record.source.url, '_blank');
                } else {
                  message.warning('No hay enlace disponible para esta publicación');
                }
              }}
              style={{ color: '#52c41a' }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  if (error) {
    return (
      <Alert
        message="Error al cargar los concursos"
        description={error instanceof Error ? error.message : 'Error desconocido'}
        type="error"
        showIcon
        style={{ margin: '20px 0' }}
      />
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: '24px' }}>
        <FilterOutlined /> Concursos Educativos
      </Title>

      {/* Filtros mejorados */}
      <Card 
        style={{ marginBottom: '24px' }}
        title={
          <Space>
            <FilterOutlined />
            <span>Filtros de Búsqueda Avanzados</span>
          </Space>
        }
        extra={
          <Space>
            <Button 
              icon={<ClearOutlined />} 
              onClick={handleClearFilters}
            >
              Limpiar
            </Button>
            <Button 
              type="primary" 
              icon={<RedoOutlined />}
              onClick={handleLastWeekFilter}
            >
              Última Semana
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Search
              placeholder="Buscar por título..."
              value={filters.title_contains}
              onChange={(e) => handleFilterChange('title_contains', e.target.value)}
              onSearch={handleSearch}
              allowClear
              prefix={<SearchOutlined />}
            />
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              mode="multiple"
              placeholder="Seleccionar materias"
              value={filters.subject_ids}
              onChange={(value) => handleFilterChange('subject_ids', value)}
              style={{ width: '100%' }}
              allowClear
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase()) || false
              }
            >
              {subjects?.map((subject: any) => (
                <Option key={subject.id} value={subject.id}>
                  {subject.name}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              mode="multiple"
              placeholder="Seleccionar ciudades"
              value={filters.cities}
              onChange={(value) => handleFilterChange('cities', value)}
              style={{ width: '100%' }}
              allowClear
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase()) || false
              }
            >
              {citiesData?.cities?.map((city: string) => (
                <Option key={city} value={city}>
                  {city}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              mode="multiple"
              placeholder="Seleccionar departamentos"
              value={filters.departments}
              onChange={(value) => handleFilterChange('departments', value)}
              style={{ width: '100%' }}
              allowClear
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase()) || false
              }
            >
              {departmentsData?.departments?.map((dept: string) => (
                <Option key={dept} value={dept}>
                  {dept}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <RangePicker
              value={[filters.date_from, filters.date_to]}
              onChange={(dates) => {
                handleFilterChange('date_from', dates ? dates[0] : null);
                handleFilterChange('date_to', dates ? dates[1] : null);
              }}
              style={{ width: '100%' }}
              placeholder={['Fecha desde', 'Fecha hasta']}
              format="DD/MM/YYYY"
            />
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <Space>
              <Button 
                type="primary" 
                icon={<SearchOutlined />}
                onClick={handleSearch}
                loading={isLoading}
              >
                Buscar
              </Button>
              <Button 
                icon={<ExportOutlined />}
                onClick={handleExport}
                disabled={selectedRowKeys.length === 0}
              >
                Exportar ({selectedRowKeys.length})
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tabla de resultados */}
      <Card>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>
            Resultados ({contestsData?.total || 0} concursos encontrados)
          </Text>
          {selectedRowKeys.length > 0 && (
            <Text type="secondary">
              {selectedRowKeys.length} seleccionados
            </Text>
          )}
        </div>

        <Table
          columns={columns}
          dataSource={contestsData?.contests || []}
          rowKey="id"
          loading={isLoading}
          rowSelection={rowSelection}
          pagination={false}
          scroll={{ x: 1200 }}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                description="No se encontraron concursos"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />

        {/* Paginación mejorada */}
        {contestsData?.total && contestsData.total > pageSize && (
          <div style={{ marginTop: '16px', textAlign: 'right' }}>
            <Pagination
              current={current}
              total={contestsData.total}
              pageSize={pageSize}
              onChange={(page, size) => {
                setCurrent(page);
                setPageSize(size || 10);
              }}
              showSizeChanger
              showQuickJumper
              showTotal={(total, range) =>
                `${range[0]}-${range[1]} de ${total} concursos`
              }
              pageSizeOptions={['10', '20', '50', '100']}
            />
          </div>
        )}
      </Card>

      {/* Drawer para detalles */}
      <Drawer
        title={
          <Space>
            <InfoCircleOutlined />
            Detalles del Concurso
          </Space>
        }
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={600}
      >
        {selectedContest && (
          <div>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Título">
                <Text strong>{selectedContest.title}</Text>
              </Descriptions.Item>
              
              <Descriptions.Item label="Descripción">
                {selectedContest.description}
              </Descriptions.Item>
              
              <Descriptions.Item label="Escuela">
                <div>
                  <Text strong>{selectedContest.school.name}</Text>
                  <br />
                  <Text type="secondary">
                    {selectedContest.school.city}, {selectedContest.school.department}
                  </Text>
                </div>
              </Descriptions.Item>
              
              <Descriptions.Item label="Materia">
                <Tag color="blue">{selectedContest.subject.name}</Tag>
              </Descriptions.Item>
              
              <Descriptions.Item label="Fecha del Concurso">
                {selectedContest.date 
                  ? dayjs(selectedContest.date).format('DD/MM/YYYY HH:mm')
                  : 'No especificada'
                }
              </Descriptions.Item>
              
              <Descriptions.Item label="Fecha de Publicación">
                {selectedContest.publication_date 
                  ? dayjs(selectedContest.publication_date).format('DD/MM/YYYY')
                  : 'No especificada'
                }
              </Descriptions.Item>
              
              {selectedContest.registration_deadline && (
                <Descriptions.Item label="Fecha de Cierre">
                  <Text type="warning">
                    {dayjs(selectedContest.registration_deadline).format('DD/MM/YYYY')}
                  </Text>
                </Descriptions.Item>
              )}
              
              {selectedContest.level && (
                <Descriptions.Item label="Nivel">
                  {selectedContest.level}
                </Descriptions.Item>
              )}
              
              {selectedContest.shift && (
                <Descriptions.Item label="Turno">
                  {selectedContest.shift}
                </Descriptions.Item>
              )}
              
              {selectedContest.hours_to_cover && (
                <Descriptions.Item label="Horas a cubrir">
                  {selectedContest.hours_to_cover} horas
                </Descriptions.Item>
              )}
              
              {selectedContest.contract_type && (
                <Descriptions.Item label="Tipo de Contrato">
                  {selectedContest.contract_type}
                </Descriptions.Item>
              )}
              
              <Descriptions.Item label="Fuente">
                <Tag color={selectedContest.source?.name === 'Facebook' ? 'geekblue' : 'purple'}>
                  {selectedContest.source?.name}
                </Tag>
              </Descriptions.Item>
              
              <Descriptions.Item label="Estado">
                <Badge 
                  status={selectedContest.is_active ? 'success' : 'default'} 
                  text={selectedContest.is_active ? 'Activo' : 'Inactivo'} 
                />
              </Descriptions.Item>
              
              <Descriptions.Item label="Enlace Original">
                <Button
                  type="link"
                  icon={<LinkOutlined />}
                  onClick={() => window.open(selectedContest.source?.url, '_blank')}
                >
                  Ver fuente original
                </Button>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ContestListAntD;
