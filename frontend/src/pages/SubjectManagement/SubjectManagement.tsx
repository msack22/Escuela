import React, { useState } from 'react';
import {
  Table,
  Tag,
  Typography,
  Drawer,
  Space,
  Badge,
  Input,
  Button,
} from 'antd';
import { BookOutlined, SearchOutlined, LinkOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../../services/api';

const { Title, Text } = Typography;

interface SubjectStat {
  id: number;
  name: string;
  normalized_name: string;
  contest_count: number;
  item_count: number;
}

interface ContestRow {
  id: number;
  title: string;
  date: string | null;
  level: string | null;
  source_url: string;
  school: { name: string; city: string; department: string } | null;
  hours_to_cover: number | null;
  grade: string | null;
  caracter: string | null;
}

const fetchStats = async (): Promise<SubjectStat[]> => {
  const res = await fetch(`${API_BASE_URL}/api/subjects/stats`);
  return res.json();
};

const fetchContests = async (id: number): Promise<ContestRow[]> => {
  const res = await fetch(`${API_BASE_URL}/api/subjects/${id}/contests`);
  return res.json();
};

const levelColor = (level: string | null) => {
  if (!level) return 'default';
  const l = level.toLowerCase();
  if (l.startsWith('secundar')) return 'blue';
  if (l.startsWith('primar'))   return 'green';
  if (l.startsWith('superior')) return 'purple';
  if (l.startsWith('inicial'))  return 'orange';
  if (l.startsWith('supervis')) return 'cyan';
  return 'default';
};

const SubjectManagement: React.FC = () => {
  const [search, setSearch]                 = useState('');
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [selected, setSelected]             = useState<SubjectStat | null>(null);
  const [contestSearch, setContestSearch]   = useState('');

  const { data: stats = [], isLoading } = useQuery<SubjectStat[]>({
    queryKey: ['subject-stats'],
    queryFn: fetchStats,
  });

  const { data: contests = [], isLoading: loadingContests } = useQuery<ContestRow[]>({
    queryKey: ['subject-contests', selected?.id],
    queryFn: () => fetchContests(selected!.id),
    enabled: !!selected,
  });

  const filtered = stats.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.normalized_name.toLowerCase().includes(q)
    );
  });

  const filteredContests = contests.filter((c) => {
    const q = contestSearch.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.school?.name ?? '').toLowerCase().includes(q) ||
      (c.school?.city ?? '').toLowerCase().includes(q)
    );
  });

  const openDrawer = (subject: SubjectStat) => {
    setSelected(subject);
    setContestSearch('');
    setDrawerOpen(true);
  };

  const columns = [
    {
      title: 'Materia',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: SubjectStat) => (
        <Space direction="vertical" size={2}>
          <Text strong>{name}</Text>
          {row.normalized_name !== name && (
            <Tag color="geekblue" style={{ fontSize: 11, borderRadius: 999 }}>
              {row.normalized_name}
            </Tag>
          )}
        </Space>
      ),
      sorter: (a: SubjectStat, b: SubjectStat) => a.name.localeCompare(b.name, 'es'),
    },
    {
      title: 'Grupo',
      dataIndex: 'normalized_name',
      key: 'group',
      width: 180,
      filters: [...new Set(stats.map((s) => s.normalized_name))]
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map((g) => ({ text: g, value: g })),
      onFilter: (value: any, record: SubjectStat) => record.normalized_name === value,
      render: (g: string, row: SubjectStat) =>
        g === row.name ? (
          <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        ) : (
          <Tag color="geekblue" style={{ borderRadius: 999 }}>{g}</Tag>
        ),
    },
    {
      title: 'Concursos',
      dataIndex: 'contest_count',
      key: 'contests',
      width: 110,
      sorter: (a: SubjectStat, b: SubjectStat) => a.contest_count - b.contest_count,
      defaultSortOrder: 'descend' as const,
      render: (n: number) => (
        <Badge
          count={n}
          showZero
          style={{
            backgroundColor: n === 0 ? '#374151' : n < 5 ? '#3b82f6' : '#10b981',
            fontWeight: 600,
          }}
        />
      ),
    },
    {
      title: 'Ítems',
      dataIndex: 'item_count',
      key: 'items',
      width: 80,
      sorter: (a: SubjectStat, b: SubjectStat) => a.item_count - b.item_count,
      render: (n: number) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{n}</Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_: any, row: SubjectStat) => (
        <Button
          size="small"
          type="link"
          disabled={row.contest_count === 0}
          onClick={() => openDrawer(row)}
        >
          Ver concursos
        </Button>
      ),
    },
  ];

  const contestColumns = [
    {
      title: 'Concurso',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, row: ContestRow) => (
        <Space direction="vertical" size={2}>
          <a href={row.source_url} target="_blank" rel="noopener noreferrer">
            <Space size={4}>
              <LinkOutlined style={{ fontSize: 11 }} />
              <Text style={{ fontSize: 13 }}>{title}</Text>
            </Space>
          </a>
          {row.school && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {row.school.name} · {row.school.city}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Nivel',
      dataIndex: 'level',
      key: 'level',
      width: 110,
      render: (level: string | null) =>
        level ? (
          <Tag color={levelColor(level)} style={{ borderRadius: 999 }}>
            {level.charAt(0).toUpperCase() + level.slice(1).toLowerCase()}
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Hs',
      dataIndex: 'hours_to_cover',
      key: 'hours',
      width: 55,
      render: (h: number | null) =>
        h ? <Text style={{ fontSize: 12 }}>{h}hs</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Fecha',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      render: (d: string | null) =>
        d ? (
          <Text style={{ fontSize: 12 }}>
            {new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 20 }} align="center">
        <BookOutlined style={{ fontSize: 20, color: '#9ca3af' }} />
        <Title level={4} style={{ margin: 0 }}>
          Materias
        </Title>
        <Tag style={{ borderRadius: 999 }}>{stats.length} en total</Tag>
      </Space>

      <Input
        prefix={<SearchOutlined />}
        placeholder="Buscar materia o grupo..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ maxWidth: 320, marginBottom: 16 }}
      />

      <Table<SubjectStat>
        rowKey="id"
        loading={isLoading}
        dataSource={filtered}
        columns={columns}
        size="small"
        pagination={{ pageSize: 30, showSizeChanger: true, pageSizeOptions: ['20', '30', '50', '100'] }}
        onRow={(record) => ({
          onClick: () => record.contest_count > 0 && openDrawer(record),
          style: { cursor: record.contest_count > 0 ? 'pointer' : 'default' },
        })}
      />

      <Drawer
        title={
          selected && (
            <Space direction="vertical" size={2}>
              <Text strong style={{ fontSize: 16 }}>{selected.name}</Text>
              {selected.normalized_name !== selected.name && (
                <Tag color="geekblue" style={{ borderRadius: 999 }}>
                  Grupo: {selected.normalized_name}
                </Tag>
              )}
            </Space>
          )
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={780}
        extra={
          selected && (
            <Tag color="green" style={{ borderRadius: 999 }}>
              {selected.contest_count} concurso{selected.contest_count !== 1 ? 's' : ''}
            </Tag>
          )
        }
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="Buscar en esta materia..."
          value={contestSearch}
          onChange={(e) => setContestSearch(e.target.value)}
          allowClear
          style={{ marginBottom: 12 }}
        />
        <Table<ContestRow>
          rowKey="id"
          loading={loadingContests}
          dataSource={filteredContests}
          columns={contestColumns}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false }}
        />
      </Drawer>
    </div>
  );
};

export default SubjectManagement;
