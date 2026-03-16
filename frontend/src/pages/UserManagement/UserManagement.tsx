import React, { useState } from 'react';
import {
  Table,
  Typography,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Popconfirm,
  Alert,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, createUser, updateUser, deleteUser } from '../../services/api';

const { Title } = Typography;

const UserManagement: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      message.success('Usuario creado correctamente');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
      form.resetFields();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Error al crear usuario';
      message.error(Array.isArray(msg) ? msg.join(' ') : String(msg));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateUser(id, data),
    onSuccess: () => {
      message.success('Usuario actualizado');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
      setEditingId(null);
      form.resetFields();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Error al actualizar';
      message.error(Array.isArray(msg) ? msg.join(' ') : String(msg));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      message.success('Usuario eliminado');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Error al eliminar usuario';
      message.error(Array.isArray(msg) ? msg.join(' ') : String(msg));
    },
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    form.setFieldsValue({ username: '', email: '', phone_number: '', is_active: true });
    setModalOpen(true);
  };

  const handleOpenEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      username: record.username,
      email: record.email,
      phone_number: record.phone_number ?? '',
      is_active: record.is_active ?? true,
    });
    setModalOpen(true);
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (editingId != null) {
        updateMutation.mutate({ id: editingId, data: values });
      } else {
        createMutation.mutate(values);
      }
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: 'Nombre', dataIndex: 'username', key: 'username' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Teléfono', dataIndex: 'phone_number', key: 'phone_number' },
    {
      title: 'Activo',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (v: boolean) => (v ? 'Sí' : 'No'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 160,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleOpenEdit(record)}>
            Editar
          </Button>
          <Popconfirm
            title="¿Eliminar este usuario?"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button type="link" danger size="small">
              Eliminar
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (error) {
    return (
      <Alert type="error" title="Error al cargar usuarios" description={(error as Error)?.message} />
    );
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        Usuarios
      </Title>

      <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} style={{ marginBottom: 16 }}>
        Nuevo usuario
      </Button>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={users}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingId != null ? 'Editar usuario' : 'Nuevo usuario'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="Nombre de usuario" rules={[{ required: true }]}>
            <Input placeholder="Nombre" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input type="email" placeholder="email@ejemplo.com" />
          </Form.Item>
          <Form.Item name="phone_number" label="Teléfono">
            <Input placeholder="+54 9 ..." />
          </Form.Item>
          <Form.Item name="is_active" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
