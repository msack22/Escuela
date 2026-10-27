import React, { useState } from 'react';
import {
  Table,
  Tag,
  Typography,
  Space,
  Button,
  Input,
  Alert,
  Tooltip,
} from 'antd';
import {
  WarningOutlined,
  SearchOutlined,
  LinkOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../../services/api';

const { Title, Text } = Typography;

interface LowConfRow {
  id: number;
  title: string;
  date: string | null;
  level: string | null;
  source_url: string;
  source_name: string;
  created_at: string | null;
  school: { name: string; city: string; department: string } | null;
  subject: { id: number; name: string } | null;
  items_count: number;
  reason: 'sin_items' | 'subject_general';
}

const fetchLowConfidence = async (): Promise<LowConfRow[]> => {
  const res = await fetch(`${API_BASE_URL}/api/contests/low-confidence?limit=200`);
  return res.json();
};

const LowConfidence: React.FC = () => {
  const [search, setSearch] = useState('');

  const { data = [], isLoading } = useQuery<LowConfRow[]>({
    queryKey: ['low-confidence-contests'],
    queryFn: fetchLowConfidence,
  });

  const filtered = data.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.school?.name ?? '').toLowerCase().includes(q) ||
      (c.school?.city ?? '').toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      title: 'Problema',
      dataIndex: 'reason',
      key: 'reason',
      width: 120,
      filters: [
        { text: 'Sin materias', value: 'sin_items' },
        { text: 'Materia General', value: 'subject_general' },
      ],
      onFilter: (value: any, record: LowConfRow) => record.reason === value,
      render: (r: string) => (
        <Tooltip
          title={
            r === 'sin_items'
              ? 'Este concurso no tiene materias/cargos extraídos del texto'
              : 'La materia asignada es "General" (no se pudo determinar la materia específica)'
          }
        >
          <Tag
            color={r === 'sin_items' ? 'red' : 'orange'}
            icon={<ExclamationCircleOutlined />}
          >
            {r === 'sin_items' ? 'Sin materias' : 'General'}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Concurso',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, row: LowConfRow) => (
        <Space direction="vertical" size={2}>
          <a href={row.source_url} target="_blank" rel="noopener noreferrer">
            <Space size={4}>
              <LinkOutlined style={{ fontSize: 11 }} />
              <Text style={{ fontSize: 13 }}>{title}</Text>
            </Space>
          </a>
          {row.school && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {row.school.name} · {row.school.city} ({row.school.department})
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Materia actual',
      dataIndex: 'subject',
      key: 'subject',
      width: 160,
      render: (s: { name: string } | null) =>
        s ? (
          <Tag color={s.name.toLowerCase() === 'general' ? 'orange' : 'blue'}>
            {s.name}
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Nivel',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string | null) =>
        level ? <Tag color="blue">{level}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Fecha',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      sorter: (a: LowConfRow, b: LowConfRow) =>
        (a.date ?? '').localeCompare(b.date ?? ''),
      render: (d: string | null) =>
        d ? (
          <Text style={{ fontSize: 12 }}>
            {new Date(d).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
            })}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Fuente',
      dataIndex: 'source_url',
      key: 'source_url',
      width: 80,
      render: (url: string) => (
        <Button
          type="link"
          size="small"
          icon={<LinkOutlined />}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver
        </Button>
      ),
    },
  ];

  const sinItems = data.filter((c) => c.reason === 'sin_items').length;
  const general = data.filter((c) => c.reason === 'subject_general').length;

  return (
    <div>
      <Space style={{ marginBottom: 20 }} align="center">
        <WarningOutlined style={{ fontSize: 20, color: '#f59e0b' }} />
        <Title level={4} style={{ margin: 0 }}>
          Concursos de baja confianza
        </Title>
        <Tag color="orange">{data.length} total</Tag>
      </Space>

      <Alert
        type="warning"
        showIcon
        message="Estos concursos necesitan revisión manual"
        description={
          <span>
            <strong>{sinItems}</strong> sin materias extraídas (el parser no pudo identificar las asignaturas) ·{' '}
            <strong>{general}</strong> con materia "General" (no se pudo determinar la materia específica).
            Revisá cada uno en la fuente original y, si es necesario, editá el concurso desde la pantalla de Concursos.
          </span>
        }
        style={{ marginBottom: 16 }}
      />

      <Input
        prefix={<SearchOutlined />}
        placeholder="Buscar por título, escuela o ciudad..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ maxWidth: 380, marginBottom: 16 }}
      />

      <Table<LowConfRow>
        rowKey="id"
        loading={isLoading}
        dataSource={filtered}
        columns={columns}
        size="small"
        pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: ['25', '50', '100'] }}
        rowClassName={(record) =>
          record.reason === 'sin_items' ? 'row-warning-red' : 'row-warning-orange'
        }
      />
    </div>
  );
};

export default LowConfidence;
