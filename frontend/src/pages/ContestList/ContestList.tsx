import React, { useState } from 'react';
import {
  Table,
  Typography,
  Form,
  Input,
  Button,
  Row,
  Col,
  Space,
  Select,
  Modal,
  Tag,
} from 'antd';
import {
  SearchOutlined,
  ClearOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchContests,
  fetchCities,
  fetchDepartments,
  fetchSources,
  deleteContest,
} from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface Contest {
  id: number;
  title?: string;
  description?: string;
  school?: { name?: string; city?: string; department?: string; address?: string };
  subject?: { name?: string };
  source?: { url?: string; name?: string };
  date?: string;
  publication_date?: string;
  registration_deadline?: string;
  level?: string;
  shift?: string;
  schedule?: string;
  hours_to_cover?: number;
  contract_type?: string;
  is_active?: boolean;
}

// Colores consistentes por categoría para ayudar a agrupar visualmente
const CATEGORY_COLORS: Record<string, string[]> = {
  subject: ['magenta', 'volcano', 'blue', 'geekblue', 'purple', 'cyan', 'gold', 'lime'],
  city: ['green', 'blue', 'cyan', 'geekblue', 'purple'],
  department: ['orange', 'volcano', 'gold', 'magenta', 'red'],
  source: ['geekblue', 'purple', 'cyan', 'gold', 'green'],
};

const getColorForCategory = (category: keyof typeof CATEGORY_COLORS, value?: string) => {
  if (!value) return undefined;
  const palette = CATEGORY_COLORS[category] || ['blue'];
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  const index = hash % palette.length;
  return palette[index];
};

const ContestList: React.FC = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    title_contains: '',
    subject_contains: '',
    cities: [] as string[],
    departments: [] as string[],
    source_name: undefined as string | undefined,
  });
  const [infoModalContest, setInfoModalContest] = useState<Contest | null>(null);

  const { data: contestsData, isLoading } = useQuery({
    queryKey: ['contests', filters],
    queryFn: () => fetchContests(filters),
  });

  const { data: citiesData } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
  });
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });
  const { data: sourcesData, isLoading: sourcesLoading, error: sourcesError } = useQuery({
    queryKey: ['sources'],
    queryFn: fetchSources,
    staleTime: 60_000,
  });

  const handleDeleteContest = (contest: Contest) => {
    Modal.confirm({
      title: 'Eliminar concurso',
      icon: <ExclamationCircleOutlined />,
      content: (
        <>
          <p>¿Estás seguro de que querés eliminar este concurso?</p>
          {contest.title && <p><strong>{contest.title}</strong></p>}
          <p style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            Esta acción eliminará el registro de la base de datos.
          </p>
        </>
      ),
      okText: 'Sí, eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      async onOk() {
        try {
          await deleteContest(contest.id);
          await queryClient.invalidateQueries({ queryKey: ['contests'] });
        } catch (error) {
          console.error('Error eliminando concurso', error);
        }
      },
    });
  };

  const columns = [
    { title: 'Título', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: 'Ciudad',
      key: 'city',
      dataIndex: ['school', 'city'],
      width: 120,
      render: (v: string | undefined) =>
        v ? (
          <Tag color={getColorForCategory('city', v)} style={{ borderRadius: 999 }}>
            {v}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Departamento',
      key: 'department',
      dataIndex: ['school', 'department'],
      width: 140,
      render: (v: string | undefined) =>
        v ? (
          <Tag color={getColorForCategory('department', v)} style={{ borderRadius: 999 }}>
            {v}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Materia',
      key: 'subject',
      dataIndex: ['subject', 'name'],
      width: 140,
      render: (v: string | undefined) =>
        v ? (
          <Tag color={getColorForCategory('subject', v)} style={{ borderRadius: 999 }}>
            {v}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Fecha publicación',
      key: 'publication_date',
      dataIndex: 'publication_date',
      width: 120,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('es-AR') : '—'),
    },
    {
      title: 'Fecha concurso',
      key: 'date',
      dataIndex: 'date',
      width: 120,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('es-AR') : '—'),
    },
    {
      title: 'Fuente',
      key: 'source',
      width: 180,
      ellipsis: true,
      render: (_: unknown, r: Contest) =>
        r.source?.name ? (
          <Tag
            color={getColorForCategory('source', r.source?.name)}
            style={{ borderRadius: 999, maxWidth: 160 }}
            title={r.source?.name}
          >
            <span
              style={{ maxWidth: 140, display: 'inline-block' }}
              className="text-ellipsis overflow-hidden whitespace-nowrap"
            >
              {r.source?.name}
            </span>
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Link',
      key: 'source_url',
      width: 80,
      render: (_: unknown, r: Contest) =>
        r.source?.url ? (
          <a href={r.source.url} target="_blank" rel="noopener noreferrer">
            Ver
          </a>
        ) : (
          '—'
        ),
    },
    {
      title: '',
      key: 'acciones',
      width: 120,
      render: (_: unknown, r: Contest) => (
        <Space>
          <Button
            type="text"
            icon={<InfoCircleOutlined />}
            onClick={() => setInfoModalContest(r)}
            title="Ver información completa"
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            title="Eliminar concurso"
            onClick={() => handleDeleteContest(r)}
          />
        </Space>
      ),
    },
  ];

  const handleClear = () => {
    setFilters({
      title_contains: '',
      subject_contains: '',
      cities: [],
      departments: [],
      source_name: undefined,
    });
  };

  const sourcesList: { name: string }[] = Array.isArray(sourcesData) ? sourcesData : [];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        Concursos educativos
      </Title>

      <Form layout="vertical" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Form.Item label="Título">
              <Input
                value={filters.title_contains}
                onChange={(e) =>
                  setFilters({ ...filters, title_contains: e.target.value })
                }
                placeholder="Buscar por título"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={6}>
            <Form.Item label="Materias">
              <Input
                value={filters.subject_contains}
                onChange={(e) => setFilters({ ...filters, subject_contains: e.target.value })}
                placeholder="Ej: física, preceptor, domiciliaria"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={6}>
            <Form.Item label="Ciudades">
              <Select
                mode="multiple"
                value={filters.cities}
                onChange={(vals) =>
                  setFilters({ ...filters, cities: vals })
                }
                placeholder="Seleccionar ciudades"
              >
                {(Array.isArray(citiesData) ? citiesData : (citiesData as any)?.cities ?? [])?.map((c: string) => (
                  <Option key={c} value={c}>
                    {c}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={6}>
            <Form.Item label="Departamentos">
              <Select
                mode="multiple"
                value={filters.departments}
                onChange={(vals) =>
                  setFilters({ ...filters, departments: vals })
                }
                placeholder="Seleccionar departamentos"
              >
                {(Array.isArray(departmentsData) ? departmentsData : (departmentsData as any)?.departments ?? [])?.map((d: string) => (
                  <Option key={d} value={d}>
                    {d}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={6}>
            <Form.Item label="Fuente">
              <Select
                allowClear
                value={filters.source_name ?? undefined}
                onChange={(val) =>
                  setFilters({ ...filters, source_name: val ?? undefined })
                }
                placeholder={
                  sourcesLoading
                    ? 'Cargando fuentes...'
                    : sourcesError
                      ? 'Error al cargar fuentes'
                      : 'Todas las fuentes'
                }
                loading={sourcesLoading}
                style={{ width: '100%' }}
                showSearch
                optionFilterProp="label"
              >
                {sourcesList.map((s) => (
                  <Option key={s.name} value={s.name} label={s.name}>
                    {s.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Space>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => setFilters({ ...filters })}
          >
            Buscar
          </Button>
          <Button icon={<ClearOutlined />} onClick={handleClear}>
            Limpiar
          </Button>
        </Space>
      </Form>

      <Table<Contest>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={contestsData?.contests ?? contestsData?.results ?? []}
      />

      <Modal
        title="Información del concurso"
        open={!!infoModalContest}
        onCancel={() => setInfoModalContest(null)}
        footer={[
          infoModalContest?.source?.url ? (
            <Button key="link" type="primary" href={infoModalContest.source.url} target="_blank" rel="noopener noreferrer">
              Ver fuente
            </Button>
          ) : null,
          <Button key="close" onClick={() => setInfoModalContest(null)}>Cerrar</Button>,
        ].filter(Boolean)}
        width={560}
      >
        {infoModalContest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {infoModalContest.title && (
              <div>
                <Text strong>Título</Text>
                <div>{infoModalContest.title}</div>
              </div>
            )}
            {infoModalContest.description != null && infoModalContest.description !== '' && (
              <div>
                <Text strong>Descripción</Text>
                <div style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{infoModalContest.description}</div>
              </div>
            )}
            {infoModalContest.school?.name && (
              <div>
                <Text strong>Establecimiento</Text>
                <div>{infoModalContest.school.name}</div>
              </div>
            )}
            {(infoModalContest.school?.city || infoModalContest.school?.department) && (
              <div>
                <Text strong>Ubicación</Text>
                <div>
                  {[infoModalContest.school?.city, infoModalContest.school?.department].filter(Boolean).join(', ')}
                  {infoModalContest.school?.address && ` — ${infoModalContest.school.address}`}
                </div>
              </div>
            )}
            {infoModalContest.subject?.name && (
              <div>
                <Text strong>Materia</Text>
                <div>{infoModalContest.subject.name}</div>
              </div>
            )}
            {(infoModalContest.publication_date || infoModalContest.date) && (
              <div>
                <Text strong>Fechas</Text>
                <div>
                  {infoModalContest.publication_date && `Publicación: ${new Date(infoModalContest.publication_date).toLocaleDateString('es-AR')}`}
                  {infoModalContest.publication_date && infoModalContest.date && ' — '}
                  {infoModalContest.date && `Concurso: ${new Date(infoModalContest.date).toLocaleString('es-AR')}`}
                  {infoModalContest.registration_deadline && ` — Cierre inscripción: ${new Date(infoModalContest.registration_deadline).toLocaleDateString('es-AR')}`}
                </div>
              </div>
            )}
            {(infoModalContest.level || infoModalContest.shift || infoModalContest.contract_type) && (
              <div>
                <Text strong>Detalles</Text>
                <div>
                  {[infoModalContest.level && `Nivel: ${infoModalContest.level}`, infoModalContest.shift && `Turno: ${infoModalContest.shift}`, infoModalContest.contract_type && `Contrato: ${infoModalContest.contract_type}`, infoModalContest.hours_to_cover != null && `Horas: ${infoModalContest.hours_to_cover}`].filter(Boolean).join(' · ')}
                </div>
              </div>
            )}
            {infoModalContest.schedule != null && infoModalContest.schedule !== '' && (
              <div>
                <Text strong>Horarios</Text>
                <div style={{ whiteSpace: 'pre-wrap' }}>{infoModalContest.schedule}</div>
              </div>
            )}
            {infoModalContest.source?.name && (
              <div>
                <Text strong>Fuente</Text>
                <div>{infoModalContest.source.name}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ContestList;

