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
} from 'antd';
import { SearchOutlined, ClearOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  fetchContests,
  fetchSubjects,
  fetchCities,
  fetchDepartments,
  fetchSources,
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

const ContestList: React.FC = () => {
  const [filters, setFilters] = useState({
    title_contains: '',
    subject_ids: [] as number[],
    cities: [] as string[],
    departments: [] as string[],
    source_name: undefined as string | undefined,
  });
  const [infoModalContest, setInfoModalContest] = useState<Contest | null>(null);

  const { data: contestsData, isLoading } = useQuery({
    queryKey: ['contests', filters],
    queryFn: () => fetchContests(filters),
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
  const { data: sourcesData, isLoading: sourcesLoading, error: sourcesError } = useQuery({
    queryKey: ['sources'],
    queryFn: fetchSources,
    staleTime: 60_000,
  });

  const columns = [
    { title: 'Título', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: 'Ciudad',
      key: 'city',
      dataIndex: ['school', 'city'],
      width: 120,
    },
    {
      title: 'Departamento',
      key: 'department',
      dataIndex: ['school', 'department'],
      width: 140,
    },
    {
      title: 'Materia',
      key: 'subject',
      dataIndex: ['subject', 'name'],
      width: 140,
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
      render: (_: unknown, r: Contest) => (
        <span title={r.source?.name ?? ''}>
          {r.source?.name ?? '—'}
        </span>
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
      key: 'info',
      width: 64,
      render: (_: unknown, r: Contest) => (
        <Button
          type="text"
          icon={<InfoCircleOutlined />}
          onClick={() => setInfoModalContest(r)}
          title="Ver información completa"
        />
      ),
    },
  ];

  const handleClear = () => {
    setFilters({
      title_contains: '',
      subject_ids: [],
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
              <Select
                mode="multiple"
                value={filters.subject_ids}
                onChange={(vals) =>
                  setFilters({ ...filters, subject_ids: vals })
                }
                placeholder="Seleccionar materias"
              >
                {subjects?.map((s: any) => (
                  <Option key={s.id} value={s.id}>
                    {s.name}
                  </Option>
                ))}
              </Select>
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
                  {infoModalContest.date && `Concurso: ${new Date(infoModalContest.date).toLocaleDateString('es-AR')}`}
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

