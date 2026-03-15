import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  NotificationsActive as NotificationIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  fetchAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  sendTestNotification,
  fetchSubjects,
} from '../../services/api';

const AlertManagement: React.FC = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any>(null);
  const [testNotificationOpen, setTestNotificationOpen] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [formData, setFormData] = useState({
    user_name: '',
    whatsapp_number: '',
    subject_preferences: [] as string[],
    max_distance_km: 50,
  });

  const queryClient = useQueryClient();

  const { data: alerts, isPending } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
  });
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });

  const createMutation = useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setOpenDialog(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateAlert(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setOpenDialog(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const testNotificationMutation = useMutation({
    mutationFn: sendTestNotification,
    onSuccess: (data) => {
      alert(data.message || 'Notificación de prueba enviada');
      setTestNotificationOpen(false);
      setTestPhoneNumber('');
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Error al enviar notificación de prueba');
    },
  });

  const resetForm = () => {
    setFormData({
      user_name: '',
      whatsapp_number: '',
      subject_preferences: [],
      max_distance_km: 50,
    });
    setEditingAlert(null);
  };

  const handleOpenDialog = (alert?: any) => {
    if (alert) {
      setFormData({
        user_name: alert.user_name,
        whatsapp_number: alert.whatsapp_number,
        subject_preferences: JSON.parse(alert.subject_preferences || '[]'),
        max_distance_km: alert.max_distance_km,
      });
      setEditingAlert(alert);
    } else {
      resetForm();
    }
    setOpenDialog(true);
  };

  const handleSubmit = () => {
    if (editingAlert) {
      updateMutation.mutate({ id: editingAlert.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeleteAlert = (id: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta alerta?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSendTestNotification = () => {
    if (!testPhoneNumber) {
      alert('Por favor ingresa un número de WhatsApp');
      return;
    }
    testNotificationMutation.mutate(testPhoneNumber);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Gestión de Alertas</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nueva Alerta
        </Button>
      </Box>

      {/* Alert Cards */}
      <Grid container spacing={3}>
        {alerts?.map((alert: any) => (
          <Grid item xs={12} md={6} lg={4} key={alert.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6">{alert.user_name}</Typography>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(alert)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteAlert(alert.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>

                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {alert.whatsapp_number}
                </Typography>

                <Box mb={2}>
                  <Typography variant="body2" gutterBottom>
                    Materías preferidas:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {JSON.parse(alert.subject_preferences || '[]').map((subject: string, index: number) => (
                      <Chip key={index} label={subject} size="small" />
                    ))}
                  </Box>
                </Box>

                <Typography variant="body2" gutterBottom>
                  Distancia máxima: {alert.max_distance_km} km
                </Typography>

                <Chip
                  label={alert.is_active ? 'Activa' : 'Inactiva'}
                  color={alert.is_active ? 'success' : 'default'}
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAlert ? 'Editar Alerta' : 'Nueva Alerta'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Nombre del usuario"
              value={formData.user_name}
              onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
              fullWidth
            />

            <TextField
              label="Número de WhatsApp"
              value={formData.whatsapp_number}
              onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              placeholder="+5491112345678"
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Materías preferidas</InputLabel>
              <Select
                multiple
                value={formData.subject_preferences}
                label="Materías preferidas"
                onChange={(e) => setFormData({ ...formData, subject_preferences: e.target.value as string[] })}
                renderValue={(selected) => (
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {subjects?.map((subject: any) => (
                  <MenuItem key={subject.id} value={subject.name}>
                    {subject.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Distancia máxima (km)"
              type="number"
              value={formData.max_distance_km}
              onChange={(e) => setFormData({ ...formData, max_distance_km: parseInt(e.target.value) })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <CircularProgress size={20} />
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Notification Dialog */}
      <Dialog open={testNotificationOpen} onClose={() => setTestNotificationOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Enviar Notificación de Prueba</DialogTitle>
        <DialogContent>
          <TextField
            label="Número de WhatsApp"
            value={testPhoneNumber}
            onChange={(e) => setTestPhoneNumber(e.target.value)}
            placeholder="+5491112345678"
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestNotificationOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleSendTestNotification}
            variant="contained"
            startIcon={<SendIcon />}
            disabled={testNotificationMutation.isPending}
          >
            {testNotificationMutation.isPending ? (
              <CircularProgress size={20} />
            ) : (
              'Enviar Prueba'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Notification Button */}
      <Box position="fixed" bottom={20} right={20}>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<NotificationIcon />}
          onClick={() => setTestNotificationOpen(true)}
        >
          Probar Notificaciones
        </Button>
      </Box>
    </Box>
  );
};

export default AlertManagement;
