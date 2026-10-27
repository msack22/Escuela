import React, { useState } from 'react';
import {
  Table, Input, Select, Button, Form, Modal, Typography, Tag, Space, Tooltip, message,
} from 'antd';
import { SearchOutlined, EditOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface PadronRow {
  id: number;
  cueanexo: string;
  nombre: string;
  departamento: string;
  localidad: string;
  sector: string | null;
  ambito: string | null;
  domicilio: string | null;
  cp: string | null;
  telefono: string | null;
  updated_at: string;
}

interface PadronResponse {
  total: number;
  skip: number;
  limit: number;
  rows: PadronRow[];
}

const DEPARTMENTS = [
  'Colón', 'Concordia', 'Diamante', 'Federación', 'Federal', 'Feliciano',
  'Gualeguay', 'Gualeguaychú', 'Islas del Ibicuy', 'La Paz', 'Nogoyá',
  'Paraná', 'San Salvador', 'Tala', 'Uruguay', 'Victoria', 'Villaguay',
];

async function fetchPadron(params: { skip: number; limit: number; q?: string; departamento?: string }): Promise<PadronResponse> {
  const qs = new URLSearchParams();
  qs.set('skip', String(params.skip));
  qs.set('limit', String(params.limit));
  if (params.q)           qs.set('q', params.q);
  if (params.departamento) qs.set('departamento', params.departamento);
  const r = await fetch(`${API_BASE_URL}/api/schools/padron?${qs}`);
  if (!r.ok) throw new Error('Error cargando padrón');
  return r.json();
}

async function patchPadron(cueanexo: string, data: Partial<PadronRow>): Promise<PadronRow> {
  const r = await fetch(`${API_BASE_URL}/api/schools/padron/${cueanexo}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error('Error actualizando escuela');
  return r.json();
}

async function triggerImport(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/scraping/import-padron`, { method: 'POST' });
}

export default function PadronEscuelas() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string | undefined>();
  const [editRow, setEditRow] = useState<PadronRow | null>(null);
  const [form] = Form.useForm();
  const [msg, msgCtx] = message.useMessage();

  const { data, isFetching } = useQuery<PadronResponse>({
    queryKey: ['padron', page, search, deptFilter],
    queryFn: () => fetchPadron({ skip: (page - 1) * pageSize, limit: pageSize, q: search || undefined, departamento: deptFilter }),
    placeholderData: (prev) => prev,
  });

  const updateMutation = useMutation({
    mutationFn: ({ cueanexo, values }: { cueanexo: string; values: Partial<PadronRow> }) =>
      patchPadron(cueanexo, values),
    onSuccess: () => {
      msg.success('Escuela actualizada');
      setEditRow(null);
      qc.invalidateQueries({ queryKey: ['padron'] });
    },
    onError: () => msg.error('Error al actualizar'),
  });

  const handleEdit = (row: PadronRow) => {
    setEditRow(row);
    form.setFieldsValue(row);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editRow) updateMutation.mutate({ cueanexo: editRow.cueanexo, values });
  };

  const handleImport = async () => {
    await triggerImport();
    msg.info('Importación iniciada en background (puede tardar ~2 min). Refrescá en unos minutos.');
  };

  const columns = [
    {
      title: 'CUE',
      dataIndex: 'cueanexo',
      width: 115,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      ellipsis: true,
    },
    {
      title: 'Departamento',
      dataIndex: 'departamento',
      width: 150,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Localidad',
      dataIndex: 'localidad',
      width: 160,
      ellipsis: true,
    },
    {
      title: 'Sector',
      dataIndex: 'sector',
      width: 80,
      render: (v: string | null) => v ? <Tag color={v === 'Estatal' ? 'green' : 'orange'}>{v}</Tag> : '—',
    },
    {
      title: 'Domicilio',
      dataIndex: 'domicilio',
      ellipsis: true,
      render: (v: string | null) => v || '—',
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: unknown, row: PadronRow) => (
        <Tooltip title="Editar">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(row)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 8px' }}>
      {msgCtx}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Padrón Oficial de Escuelas</Title>
        <Tooltip title="Reimporta el padrón desde datos.gob.ar (actualiza todos los registros)">
          <Button icon={<SyncOutlined />} onClick={handleImport}>
            Actualizar padrón
          </Button>
        </Tooltip>
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Buscar por nombre, CUE o localidad..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          allowClear
          style={{ width: 300 }}
        />
        <Select
          placeholder="Filtrar por departamento"
          allowClear
          value={deptFilter}
          onChange={(v) => { setDeptFilter(v); setPage(1); }}
          style={{ width: 200 }}
        >
          {DEPARTMENTS.map((d) => <Option key={d} value={d}>{d}</Option>)}
        </Select>
        <Text type="secondary">{data?.total ?? 0} escuelas</Text>
      </Space>

      <Table<PadronRow>
        dataSource={data?.rows ?? []}
        columns={columns}
        rowKey="cueanexo"
        loading={isFetching}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (t, r) => `${r[0]}-${r[1]} de ${t}`,
        }}
        scroll={{ x: 900 }}
      />

      <Modal
        open={!!editRow}
        title={`Editar: ${editRow?.nombre}`}
        onCancel={() => setEditRow(null)}
        onOk={handleSave}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={updateMutation.isPending}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="CUE">
            <Text code>{editRow?.cueanexo}</Text>
          </Form.Item>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="departamento" label="Departamento" rules={[{ required: true }]}>
            <Select showSearch>
              {DEPARTMENTS.map((d) => <Option key={d} value={d}>{d}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="localidad" label="Localidad" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sector" label="Sector">
            <Select allowClear>
              <Option value="Estatal">Estatal</Option>
              <Option value="Privado">Privado</Option>
            </Select>
          </Form.Item>
          <Form.Item name="domicilio" label="Domicilio">
            <Input />
          </Form.Item>
          <Form.Item name="telefono" label="Teléfono">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
