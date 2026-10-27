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
  Switch,
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

interface ContestItem {
  subject: string;
  hours?: number | null;
  grade?: string | null;
  llamado?: string | null;
  caracter?: string | null;
}

interface Contest {
  id: number;
  title?: string;
  description?: string;
  school?: { name?: string; city?: string; department?: string; address?: string };
  subject?: { name?: string };
  items?: ContestItem[];
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
  parent_contest_id?: number | null;
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
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [filters, setFilters] = useState({
    title_contains: '',
    subject_contains: '',
    cities: [] as string[],
    departments: [] as string[],
    source_name: undefined as string | undefined,
  });
  const [infoModalContest, setInfoModalContest] = useState<Contest | null>(null);

  const { data: contestsData, isLoading } = useQuery({
    queryKey: ['contests', filters, showOnlyActive],
    queryFn: () => fetchContests({ ...filters, ...(showOnlyActive ? { is_active: true } : {}) }),
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
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, row: Contest) => (
        <Space size={4}>
          {row.parent_contest_id != null && (
            <Tag color="purple" style={{ borderRadius: 999, fontSize: 11 }}>Ampliatoria</Tag>
          )}
          <span>{title}</span>
        </Space>
      ),
    },
    {
      title: 'Estado',
      key: 'is_active',
      dataIndex: 'is_active',
      width: 100,
      render: (v: boolean) =>
        v ? (
          <Tag color="green" style={{ borderRadius: 999 }}>Próximo</Tag>
        ) : (
          <Tag color="default" style={{ borderRadius: 999 }}>Pasado</Tag>
        ),
    },
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
      title: 'Materia(s)',
      key: 'subject',
      width: 180,
      render: (_: unknown, record: Contest) => {
        const subjects = record.items && record.items.length > 0
          ? [...new Set(record.items.map(i => i.subject))]
          : record.subject?.name ? [record.subject.name] : [];
        if (subjects.length === 0) return '—';
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {subjects.map((s) => (
              <Tag key={s} color={getColorForCategory('subject', s)} style={{ borderRadius: 999, margin: 0 }}>
                {s}
              </Tag>
            ))}
          </div>
        );
      },
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
      title: 'Nivel',
      key: 'level',
      dataIndex: 'level',
      width: 110,
      render: (v: string) => {
        if (!v) return '—';
        const lv = v.toLowerCase();
        const color =
          lv.startsWith('secundar') ? 'blue' :
          lv.startsWith('primar')   ? 'green' :
          lv.startsWith('superior') ? 'purple' :
          lv.startsWith('inicial')  ? 'orange' :
          lv.startsWith('supervis') ? 'cyan' :
          'default';
        const label = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
        return <Tag color={color} style={{ borderRadius: 999 }}>{label}</Tag>;
      },
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
          <Switch
            checked={showOnlyActive}
            onChange={setShowOnlyActive}
            checkedChildren="Solo próximos"
            unCheckedChildren="Todos"
          />
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
            {(infoModalContest.items && infoModalContest.items.length > 0) ? (
              <div>
                <Text strong>Materias / Cargos</Text>
                <div style={{ marginTop: 4 }}>
                  {infoModalContest.items.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: 6, paddingLeft: 8, borderLeft: '2px solid #374151' }}>
                      <span style={{ fontWeight: 500 }}>{item.subject}</span>
                      {item.hours != null && <span style={{ color: '#9ca3af', marginLeft: 6 }}>{item.hours}hs</span>}
                      {item.grade && <span style={{ color: '#9ca3af', marginLeft: 6 }}>· {item.grade}</span>}
                      {item.llamado && <span style={{ color: '#9ca3af', marginLeft: 6 }}>· {item.llamado}</span>}
                      {item.caracter && (
                        <span style={{ marginLeft: 6 }}>
                          <Tag color={item.caracter.toUpperCase().startsWith('TITULAR') ? 'green' : item.caracter.toUpperCase().startsWith('INTERINO') ? 'blue' : 'orange'} style={{ fontSize: 11 }}>
                            {item.caracter}
                          </Tag>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : infoModalContest.subject?.name && (
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

