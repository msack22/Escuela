import React, { useState, useMemo } from 'react';
import {
  Table,
  Typography,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Tag,
  Popconfirm,
  Alert,
  Spin,
  Select,
  DatePicker,
  Switch,
  Tooltip,
} from 'antd';
import { PlusOutlined, BellOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  fetchSubjects,
  fetchUsers,
  fetchDepartments,
  fetchAlertNotificationInfo,
  fetchAlertHistory,
  sendTestContestNotifications,
} from '../../services/api';

const { Title, Paragraph } = Typography;

const AlertManagement: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testAlertId, setTestAlertId] = useState<number | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyAlertId, setHistoryAlertId] = useState<number | null>(null);
  const [historyAlertName, setHistoryAlertName] = useState('');
  const [form] = Form.useForm();
  const [testForm] = Form.useForm();
  const watchedPrefs     = Form.useWatch('subject_preferences', form) as string[] | undefined;
  const watchedExcluded  = Form.useWatch('excluded_subjects',   form) as string[] | undefined;
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading, error } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  // Agrupa materias por normalized_name para el selector de alertas.
  // Ejemplo: "Literatura Argentina" y "Literatura Latinoamericana" aparecen
  // bajo "Literatura". Value = normalized_name → el backend matchea por grupo.
  const subjectOptions = useMemo(() => {
    if (!subjects?.length) return [];
    const groupMap = new Map<string, string[]>();
    for (const s of subjects as any[]) {
      const group: string = s.normalized_name || s.name;
      if (!groupMap.has(group)) groupMap.set(group, []);
      if (s.name !== group) groupMap.get(group)!.push(s.name as string);
    }
    return Array.from(groupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([group, specifics]) => ({
        label: specifics.length > 0
          ? `${group}  (+  ${specifics.join(', ')})`
          : group,
        value: group,
      }));
  }, [subjects]);

  // Opciones filtradas: excluye lo que ya está elegido en el otro combo
  const prefsOptions    = useMemo(() => {
    const excluded = new Set(watchedExcluded ?? []);
    return subjectOptions.filter(o => !excluded.has(o.value));
  }, [subjectOptions, watchedExcluded]);

  const excludedOptions = useMemo(() => {
    const wanted = new Set(watchedPrefs ?? []);
    return subjectOptions.filter(o => !wanted.has(o.value));
  }, [subjectOptions, watchedPrefs]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  const { data: notificationInfo } = useQuery({
    queryKey: ['alert-notification-info'],
    queryFn: fetchAlertNotificationInfo,
  });

  const { data: historyRows = [], isLoading: historyLoading } = useQuery({
    queryKey: ['alert-history', historyAlertId],
    queryFn: () => fetchAlertHistory(historyAlertId!),
    enabled: historyModalOpen && historyAlertId != null,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => createAlert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setModalOpen(false);
      form.resetFields();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateAlert(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setModalOpen(false);
      setEditingId(null);
      form.resetFields();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    form.setFieldsValue({
      user_id: undefined,
      user_name: '',
      subject_preferences: [],
      excluded_subjects: [],
      departments: [],
      digest_mode: false,
    });
    setModalOpen(true);
  };

  const handleUserSelect = (userId: number | undefined) => {
    if (userId == null) {
      form.setFieldsValue({ user_name: '' });
      return;
    }
    const u = (users as any[]).find((x: any) => x.id === userId);
    if (u) {
      form.setFieldsValue({
        user_name: u.username ?? u.name ?? '',
      });
    }
  };

  const handleOpenEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      user_id: record.user_id ?? undefined,
      user_name: record.user_name,
      subject_preferences: record.subject_preferences ?? [],
      excluded_subjects: record.excluded_subjects ?? [],
      departments: record.departments ?? [],
      digest_mode: record.digest_mode ?? false,
    });
    setModalOpen(true);
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (editingId != null) {
        updateMutation.mutate({
          id: editingId,
          data: {
            user_name: values.user_name,
            subject_preferences: values.subject_preferences,
            excluded_subjects: values.excluded_subjects ?? [],
            departments: values.departments,
            digest_mode: values.digest_mode ?? false,
          },
        });
      } else {
        createMutation.mutate({
          user_id: values.user_id ?? undefined,
          user_name: values.user_name,
          subject_preferences: values.subject_preferences ?? [],
          excluded_subjects: values.excluded_subjects ?? [],
          departments: values.departments ?? [],
          digest_mode: values.digest_mode ?? false,
        });
      }
    });
  };

  const openHistoryModal = (record: any) => {
    setHistoryAlertId(record.id);
    setHistoryAlertName(record.user_name ?? `Alerta #${record.id}`);
    setHistoryModalOpen(true);
  };

  const openTestModal = (record: any) => {
    setTestAlertId(record.id);
    testForm.setFieldsValue({
      date_from: undefined,
      date_to: undefined,
      departments: undefined,
      subject_ids: undefined,
      limit: 50,
    });
    setTestModalOpen(true);
  };

  const handleSendTestNotifications = () => {
    if (testAlertId == null) return;
    testForm.validateFields().then((values) => {
      const params: any = { limit: values.limit ?? 50 };
      if (values.date_from) params.date_from = dayjs(values.date_from).format('YYYY-MM-DD');
      if (values.date_to) params.date_to = dayjs(values.date_to).format('YYYY-MM-DD');
      if (values.departments?.length) params.departments = values.departments;
      if (values.subject_ids?.length) params.subject_ids = values.subject_ids;
      sendTestContestNotifications(testAlertId, params)
        .then((res) => {
          if (res.success) {
            setTestModalOpen(false);
            testForm.resetFields();
          }
          alert(res.message || (res.success ? 'Enviado.' : res.error));
        })
        .catch((err) => alert(err?.response?.data?.detail || err?.message || 'Error al enviar.'));
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: 'Usuario (ID)', dataIndex: 'user_id', key: 'user_id', width: 90, render: (v: number) => v ?? '-' },
    { title: 'Nombre', dataIndex: 'user_name', key: 'user_name' },
    {
      title: 'Materias (quiero)',
      dataIndex: 'subject_preferences',
      key: 'subject_preferences',
      render: (arr: string[]) =>
        Array.isArray(arr) && arr.length ? arr.map((s) => <Tag key={s} color="blue">{s}</Tag>) : <span style={{ color: '#aaa' }}>Todas</span>,
    },
    {
      title: 'Excluidas',
      dataIndex: 'excluded_subjects',
      key: 'excluded_subjects',
      render: (arr: string[]) =>
        Array.isArray(arr) && arr.length ? arr.map((s) => <Tag key={s} color="red">{s}</Tag>) : '-',
    },
    {
      title: 'Departamentos',
      dataIndex: 'departments',
      key: 'departments',
      render: (arr: string[]) =>
        Array.isArray(arr) ? arr.map((d) => <Tag key={d}>{d}</Tag>) : '-',
    },
    {
      title: 'Notif.',
      dataIndex: 'digest_mode',
      key: 'digest_mode',
      width: 90,
      render: (v: boolean) => (
        <Tag color={v ? 'orange' : 'blue'}>{v ? 'Resumen' : 'Inmediato'}</Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 260,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleOpenEdit(record)}>
            Editar
          </Button>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => openHistoryModal(record)}>
            Historial
          </Button>
          <Button type="link" size="small" onClick={() => openTestModal(record)}>
            Probar
          </Button>
          <Popconfirm
            title="¿Desactivar esta alerta?"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button type="link" danger size="small">
              Desactivar
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (error) {
    return (
      <Alert type="error" title="Error al cargar alertas" description={(error as Error)?.message} />
    );
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        Gestión de alertas
      </Title>

      {notificationInfo?.when_sent && (
        <Alert
          type="info"
          showIcon
          icon={<BellOutlined />}
          title="¿Cuándo me llegan las notificaciones?"
          description={
            <>
              <Paragraph style={{ marginBottom: 0 }}>{notificationInfo.when_sent}</Paragraph>
              {notificationInfo.how_to_trigger && (
                <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  {notificationInfo.how_to_trigger}
                </Paragraph>
              )}
            </>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} style={{ marginBottom: 16 }}>
        Nueva alerta
      </Button>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={alerts}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingId != null ? 'Editar alerta' : 'Nueva alerta'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="user_id" label="Usuario">
            <Select
              placeholder="Seleccionar usuario (opcional)"
              allowClear
              showSearch
              optionFilterProp="label"
              onChange={handleUserSelect}
              options={(users as any[])?.map((u: any) => ({
                label: `${u.username || u.name || 'Usuario'} (${u.email || 'sin email'})`,
                value: u.id,
              })) ?? []}
            />
          </Form.Item>
          <Form.Item name="user_name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Nombre del usuario (se rellena al elegir usuario)" />
          </Form.Item>
          <Form.Item
            name="subject_preferences"
            label="Materias de interés (quiero recibir)"
            extra="Las variantes específicas se muestran entre paréntesis. Las ya excluidas no aparecen aquí."
          >
            <Select
              mode="multiple"
              placeholder="Todas si no elegís ninguna"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={prefsOptions}
            />
          </Form.Item>
          <Form.Item
            name="excluded_subjects"
            label="Materias excluidas (no quiero recibir)"
            extra="Si un concurso tiene otras materias además de las excluidas, te llega igual sin ellas. Las ya elegidas como interés no aparecen aquí."
          >
            <Select
              mode="multiple"
              placeholder="Ninguna excluida"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={excludedOptions}
            />
          </Form.Item>
          <Form.Item name="departments" label="Departamentos preferidos">
            <Select
              mode="multiple"
              placeholder="Todos si no elegís ninguno"
              allowClear
              options={(Array.isArray(departments) ? departments : []).map((d: string) => ({
                label: d,
                value: d,
              }))}
            />
          </Form.Item>
          <Form.Item name="digest_mode" label="Modo resumen diario" valuePropName="checked">
            <Tooltip title="Activá para recibir un único resumen por día (7 hs) en lugar de notificaciones inmediatas">
              <Switch checkedChildren="Resumen diario" unCheckedChildren="Inmediato" />
            </Tooltip>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Historial de notificaciones — ${historyAlertName}`}
        open={historyModalOpen}
        onCancel={() => setHistoryModalOpen(false)}
        footer={null}
        width={820}
      >
        <Spin spinning={historyLoading}>
          {historyRows.length === 0 && !historyLoading ? (
            <Paragraph type="secondary">No hay notificaciones enviadas para esta alerta.</Paragraph>
          ) : (
            <Table
              rowKey="id"
              size="small"
              dataSource={historyRows}
              pagination={{ pageSize: 20 }}
              columns={[
                {
                  title: 'Enviado',
                  dataIndex: 'sent_at',
                  width: 150,
                  render: (v: string) =>
                    new Date(v).toLocaleString('es-AR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    }),
                },
                {
                  title: 'Concurso',
                  dataIndex: 'contest',
                  render: (c: any) =>
                    c ? (
                      <div>
                        <div style={{ fontWeight: 500 }}>{c.title?.slice(0, 80) ?? '—'}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                          {c.school?.city ?? ''} – {c.school?.department ?? ''}
                          {c.date ? ` · ${new Date(c.date).toLocaleDateString('es-AR')}` : ''}
                        </div>
                        <div style={{ fontSize: 12 }}>
                          {c.items?.length > 0
                            ? c.items.map((it: any, i: number) => (
                                <Tag key={i} color={it.item_type === 'cargo' ? 'purple' : 'blue'} style={{ marginBottom: 2 }}>
                                  {it.subject?.name ?? '—'}{it.hours_to_cover ? ` ${it.hours_to_cover}hs` : ''}
                                </Tag>
                              ))
                            : <Tag>{c.subject?.name ?? '—'}</Tag>}
                        </div>
                      </div>
                    ) : `Concurso #${(historyRows.find((r: any) => r.contest === c) as any)?.contest_id}`,
                },
                {
                  title: 'Estado',
                  dataIndex: 'status',
                  width: 90,
                  render: (s: string) => (
                    <Tag color={s === 'sent' ? 'green' : 'red'}>{s}</Tag>
                  ),
                },
                {
                  title: 'Fuente',
                  dataIndex: 'contest',
                  width: 80,
                  render: (c: any) =>
                    c?.source_url ? (
                      <a href={c.source_url} target="_blank" rel="noreferrer">Ver</a>
                    ) : '—',
                },
              ]}
            />
          )}
        </Spin>
      </Modal>

      <Modal
        title="Probar notificaciones de concursos"
        open={testModalOpen}
        onOk={handleSendTestNotifications}
        onCancel={() => { setTestModalOpen(false); testForm.resetFields(); }}
        okText="Enviar email de prueba"
        width={520}
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Se enviará un email al correo de la alerta con los concursos que coincidan con los filtros (fecha, departamento, materia). Opcional: dejá filtros vacíos para enviar hasta 50 concursos recientes.
        </Paragraph>
        <Form form={testForm} layout="vertical">
          <Form.Item name="date_from" label="Fecha concurso desde">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="date_to" label="Fecha concurso hasta">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="departments" label="Departamentos">
            <Select
              mode="multiple"
              placeholder="Todos si no elegís ninguno"
              allowClear
              options={(Array.isArray(departments) ? departments : []).map((d: string) => ({ label: d, value: d }))}
            />
          </Form.Item>
          <Form.Item name="subject_ids" label="Materias (por ID)">
            <Select
              mode="multiple"
              placeholder="Todas si no elegís ninguna"
              allowClear
              optionFilterProp="label"
              options={subjects?.map((s: any) => ({ label: s.name, value: s.id })) ?? []}
            />
          </Form.Item>
          <Form.Item name="limit" label="Máximo de concursos en el email" initialValue={50}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AlertManagement;
