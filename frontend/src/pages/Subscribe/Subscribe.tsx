import React, { useState, useMemo } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Typography,
  Card,
  Space,
  Result,
  Alert,
  Divider,
} from 'antd';
import {
  BellOutlined,
  WhatsAppOutlined,
  MailOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL, fetchSubjects, fetchDepartments } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const Subscribe: React.FC = () => {
  const [form] = Form.useForm();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

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
        label: specifics.length > 0 ? `${group}  (+  ${specifics.join(', ')})` : group,
        value: group,
      }));
  }, [subjects]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    setError(null);
    try {
      const body: any = {
        user_name: values.name,
        subject_preferences: values.subjects ?? [],
        excluded_subjects: [],
        departments: values.departments ?? [],
      };
      if (values.whatsapp?.trim()) body.whatsapp_number = values.whatsapp.trim();
      if (values.email?.trim()) body.email_address = values.email.trim();

      const res = await fetch(`${API_BASE_URL}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `Error ${res.status}`);
      }

      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message ?? 'Error al suscribirse. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Card style={{ maxWidth: 520, width: '100%', background: '#1e293b', border: '1px solid #334155' }}>
          <Result
            icon={<CheckCircleOutlined style={{ color: '#10b981' }} />}
            title={<span style={{ color: '#f1f5f9' }}>¡Suscripción exitosa!</span>}
            subTitle={
              <span style={{ color: '#94a3b8' }}>
                Vas a recibir avisos de concursos docentes según las materias y departamentos que elegiste.
              </span>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <Card
        style={{
          maxWidth: 580,
          width: '100%',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 12,
        }}
      >
        <Space direction="vertical" size={4} style={{ marginBottom: 24 }}>
          <Space align="center">
            <BellOutlined style={{ fontSize: 28, color: '#60a5fa' }} />
            <Title level={3} style={{ margin: 0, color: '#f1f5f9' }}>
              Alertas de Concursos Docentes
            </Title>
          </Space>
          <Paragraph style={{ color: '#94a3b8', margin: 0 }}>
            Suscribite para recibir avisos automáticos cuando se publiquen nuevos concursos en el CGE de Entre Ríos.
            Podés filtrar por materia y departamento.
          </Paragraph>
        </Space>

        <Divider style={{ borderColor: '#334155', margin: '0 0 24px' }} />

        {error && (
          <Alert
            type="error"
            message={error}
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label={<span style={{ color: '#cbd5e1' }}>Tu nombre</span>}
            rules={[{ required: true, message: 'Ingresá tu nombre' }]}
          >
            <Input placeholder="Ej: María García" size="large" />
          </Form.Item>

          <Form.Item
            name="whatsapp"
            label={
              <Space>
                <WhatsAppOutlined style={{ color: '#25d366' }} />
                <span style={{ color: '#cbd5e1' }}>Número de WhatsApp</span>
              </Space>
            }
            extra={<span style={{ color: '#64748b' }}>Ej: 3446661234 (sin 0 ni 15)</span>}
            rules={[
              {
                validator: (_, value) => {
                  const email = form.getFieldValue('email');
                  if (!value?.trim() && !email?.trim()) {
                    return Promise.reject('Completá al menos WhatsApp o email');
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="3446661234" size="large" prefix="+549" />
          </Form.Item>

          <Form.Item
            name="email"
            label={
              <Space>
                <MailOutlined style={{ color: '#60a5fa' }} />
                <span style={{ color: '#cbd5e1' }}>Email (opcional)</span>
              </Space>
            }
            rules={[{ type: 'email', message: 'Email inválido' }]}
          >
            <Input placeholder="tu@email.com" size="large" />
          </Form.Item>

          <Form.Item
            name="subjects"
            label={<span style={{ color: '#cbd5e1' }}>Materias de interés</span>}
            extra={<span style={{ color: '#64748b' }}>Dejá vacío para recibir avisos de todas las materias</span>}
          >
            <Select
              mode="multiple"
              placeholder="Buscar materia..."
              allowClear
              showSearch
              size="large"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={subjectOptions}
            />
          </Form.Item>

          <Form.Item
            name="departments"
            label={<span style={{ color: '#cbd5e1' }}>Departamentos (opcional)</span>}
            extra={<span style={{ color: '#64748b' }}>Filtrá por departamento de la escuela</span>}
          >
            <Select
              mode="multiple"
              placeholder="Todos los departamentos"
              allowClear
              size="large"
              options={(Array.isArray(departments) ? departments : []).map((d: string) => ({
                label: d,
                value: d,
              }))}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              block
              style={{ background: '#2563eb', borderColor: '#2563eb', height: 48, fontWeight: 600 }}
            >
              Suscribirme a alertas de concursos
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ borderColor: '#334155', margin: '24px 0 16px' }} />

        <Text style={{ color: '#475569', fontSize: 12 }}>
          Esta página es un servicio del Sistema de Concursos Educativos de Entre Ríos.
        </Text>
      </Card>
    </div>
  );
};

export default Subscribe;
