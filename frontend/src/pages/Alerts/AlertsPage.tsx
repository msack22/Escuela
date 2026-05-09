import React, { useState } from 'react';
import {
  Typography,
  Form,
  Input,
  Select,
  Button,
  Alert,
  Card,
  Tag,
  Divider,
  Space,
} from 'antd';
import { BellOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchSubjects, fetchDepartments, createAlert } from '../../services/api';

const { Title, Paragraph, Text } = Typography;

const AlertsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [submitted, setSubmitted] = useState(false);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => createAlert(data),
    onSuccess: () => {
      setSubmitted(true);
      form.resetFields();
    },
  });

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (!values.email_address && !values.whatsapp_number) {
        form.setFields([
          { name: 'email_address', errors: ['Ingresá al menos email o WhatsApp'] },
          { name: 'whatsapp_number', errors: ['Ingresá al menos email o WhatsApp'] },
        ]);
        return;
      }
      createMutation.mutate({
        user_name: values.user_name,
        email_address: values.email_address || undefined,
        whatsapp_number: values.whatsapp_number || undefined,
        subject_preferences: values.subject_preferences ?? [],
        departments: values.departments ?? [],
      });
    });
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <Space align="center" style={{ marginBottom: 8 }}>
        <BellOutlined style={{ fontSize: 28, color: '#1677ff' }} />
        <Title level={3} style={{ margin: 0 }}>
          Suscribirse a alertas de concursos
        </Title>
      </Space>

      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Te notificamos por email o WhatsApp cuando se publican nuevos concursos docentes
        que coincidan con tus materias y departamentos de interés.
      </Paragraph>

      {submitted && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="¡Alerta registrada!"
          description="Te vamos a avisar cuando salgan nuevos concursos que coincidan con tus filtros."
          style={{ marginBottom: 24 }}
          action={
            <Button size="small" onClick={() => setSubmitted(false)}>
              Registrar otra
            </Button>
          }
        />
      )}

      {createMutation.isError && (
        <Alert
          type="error"
          message="Error al registrar la alerta"
          description={(createMutation.error as Error)?.message}
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="user_name"
            label="Tu nombre"
            rules={[{ required: true, message: 'Ingresá tu nombre' }]}
          >
            <Input placeholder="Ej: María García" />
          </Form.Item>

          <Form.Item
            name="email_address"
            label="Email"
            rules={[{ type: 'email', message: 'Email inválido' }]}
          >
            <Input placeholder="tu@email.com" />
          </Form.Item>

          <Form.Item name="whatsapp_number" label="WhatsApp (con código de área)">
            <Input placeholder="Ej: 3442123456" />
          </Form.Item>

          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
            Ingresá al menos uno de los dos (email o WhatsApp).
          </Text>

          <Divider />

          <Form.Item
            name="subject_preferences"
            label="Materias de interés"
            extra="Dejá vacío para recibir alertas de cualquier materia."
          >
            <Select
              mode="multiple"
              placeholder="Seleccioná una o más materias"
              allowClear
              showSearch
              optionFilterProp="label"
              options={(subjects as any[]).map((s: any) => ({
                label: s.name,
                value: s.name,
              }))}
              tagRender={({ label, closable, onClose }) => (
                <Tag color="blue" closable={closable} onClose={onClose} style={{ marginBottom: 2 }}>
                  {label}
                </Tag>
              )}
            />
          </Form.Item>

          <Form.Item
            name="departments"
            label="Departamentos"
            extra="Dejá vacío para recibir alertas de todos los departamentos."
          >
            <Select
              mode="multiple"
              placeholder="Seleccioná uno o más departamentos"
              allowClear
              options={(Array.isArray(departments) ? departments : []).map((d: string) => ({
                label: d,
                value: d,
              }))}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={createMutation.isPending}
              icon={<BellOutlined />}
            >
              Registrar alerta
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AlertsPage;
