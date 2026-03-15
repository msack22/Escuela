import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Tooltip,
  Pagination,
  Grid,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Notifications as NotificationsIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns/format';

// API functions (placeholder - deberían estar en api.ts)
const fetchUsers = async () => {
  // Mock data - reemplazar con llamada real a API
  return {
    users: [
      { id: 1, email: 'user1@example.com', name: 'Usuario 1', is_active: true, notification_days_ahead: 3, created_at: new Date().toISOString() },
      { id: 2, email: 'user2@example.com', name: 'Usuario 2', is_active: true, notification_days_ahead: 7, created_at: new Date().toISOString() },
    ],
    total: 2
  };
};

const fetchAlerts = async () => {
  // Mock data - reemplazar con llamada real a API
  return {
    alerts: [
      { id: 1, user_id: 1, title: 'Alerta Matemática', description: 'Concursos de matemática en Paraná', filters: '{"subjects": [1, 2], "cities": ["Paraná"]}', is_active: true, created_at: new Date().toISOString() },
      { id: 2, user_id: 2, title: 'Alerta General', description: 'Todos los concursos', filters: '{}', is_active: true, created_at: new Date().toISOString() },
    ],
    total: 2
  };
};

const fetchNotifications = async () => {
  // Mock data - reemplazar con llamada real a API
  return {
    notifications: [
      { id: 1, user_id: 1, alert_id: 1, contest_id: 1, contest_title: 'Concurso Matemática', sent_at: new Date().toISOString(), status: 'sent', error_message: null },
      { id: 2, user_id: 1, alert_id: 1, contest_id: 2, contest_title: 'Concurso Física', sent_at: new Date(Date.now() - 86400000).toISOString(), status: 'sent', error_message: null },
      { id: 3, user_id: 2, alert_id: 2, contest_id: 3, contest_title: 'Concurso Química', sent_at: new Date(Date.now() - 172800000).toISOString(), status: 'failed', error_message: 'Email no encontrado' },
    ],
    total: 3
  };
};

const AlertManagement: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    notification_days_ahead: 3,
    filters: '{}',
    is_active: true,
  });

  const queryClient = useQueryClient();

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery('users', fetchUsers);
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery('alerts', fetchAlerts);
  const { data: notificationsData, isLoading: notificationsLoading } = useQuery('notifications', fetchNotifications);

  const createAlertMutation = useMutation(
    async (alertData: any) => {
      // Mock API call - reemplazar con llamada real
      console.log('Creating alert:', alertData);
      return { success: true };
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['alerts']);
        setAlertDialogOpen(false);
        setFormData({
          title: '',
          description: '',
          notification_days_ahead: 3,
          filters: '{}',
          is_active: true,
        });
      },
    }
  );

  const updateAlertMutation = useMutation(
    async ({ id, ...data }: any) => {
      // Mock API call - reemplazar con llamada real
      console.log('Updating alert:', id, data);
      return { success: true };
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['alerts']);
        setAlertDialogOpen(false);
      },
    }
  );

  const deleteAlertMutation = useMutation(
    async (id: number) => {
      // Mock API call - reemplazar con llamada real
      console.log('Deleting alert:', id);
      return { success: true };
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['alerts']);
      },
    }
  );

  const handleCreateAlert = () => {
    setSelectedAlert(null);
    setFormData({
      title: '',
      description: '',
      notification_days_ahead: 3,
      filters: '{}',
      is_active: true,
    });
    setAlertDialogOpen(true);
  };

  const handleEditAlert = (alert: any) => {
    setSelectedAlert(alert);
    setFormData({
      title: alert.title,
      description: alert.description,
      notification_days_ahead: selectedUser?.notification_days_ahead || 3,
      filters: alert.filters || '{}',
      is_active: alert.is_active,
    });
    setAlertDialogOpen(true);
  };

  const handleDeleteAlert = (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar esta alerta?')) {
      deleteAlertMutation.mutate(id);
    }
  };

  const handleSubmitAlert = () => {
    if (selectedAlert) {
      updateAlertMutation.mutate({ id: selectedAlert.id, ...formData });
    } else {
      createAlertMutation.mutate({ ...formData, user_id: selectedUser?.id });
    }
  };

  if (usersLoading || alertsLoading || notificationsLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Gestión de Alertas y Usuarios
      </Typography>

      <Grid container spacing={3}>
        {/* Users Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Usuarios
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Días Antelación</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usersData?.users?.map((user: any) => (
                      <TableRow 
                        key={user.id}
                        hover
                        selected={selectedUser?.id === user.id}
                        onClick={() => setSelectedUser(user)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.notification_days_ahead} días</TableCell>
                        <TableCell>
                          <Chip
                            label={user.is_active ? 'Activo' : 'Inactivo'}
                            color={user.is_active ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Seleccionar usuario">
                            <IconButton size="small" color="primary">
                              <EmailIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Alerts Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Alertas de {selectedUser ? selectedUser.name : 'Todos'}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateAlert}
                  disabled={!selectedUser}
                >
                  Nueva Alerta
                </Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Título</TableCell>
                      <TableCell>Descripción</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {alertsData?.alerts
                      ?.filter((alert: any) => !selectedUser || alert.user_id === selectedUser.id)
                      .map((alert: any) => (
                        <TableRow key={alert.id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {alert.title}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="textSecondary">
                              {alert.description?.substring(0, 50)}...
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={alert.is_active ? 'Activa' : 'Inactiva'}
                              color={alert.is_active ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Box display="flex" gap={1}>
                              <Tooltip title="Editar alerta">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditAlert(alert)}
                                  color="primary"
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar alerta">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteAlert(alert.id)}
                                  color="error"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Notifications Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Notificaciones Enviadas
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<NotificationsIcon />}
                  onClick={() => setNotificationDialogOpen(true)}
                >
                  Ver Detalles
                </Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Usuario</TableCell>
                      <TableCell>Alerta</TableCell>
                      <TableCell>Concurso</TableCell>
                      <TableCell>Fecha Envío</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell>Error</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {notificationsData?.notifications?.map((notification: any) => (
                      <TableRow key={notification.id}>
                        <TableCell>{notification.user_id}</TableCell>
                        <TableCell>{notification.alert_id}</TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {notification.contest_title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {format(new Date(notification.sent_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={notification.status}
                            color={notification.status === 'sent' ? 'success' : notification.status === 'failed' ? 'error' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {notification.error_message && (
                            <Typography variant="caption" color="error">
                              {notification.error_message}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Create/Edit Alert Dialog */}
      <Dialog open={alertDialogOpen} onClose={() => setAlertDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedAlert ? 'Editar Alerta' : 'Nueva Alerta'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Título de la Alerta"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descripción"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Días de Antelación"
                value={formData.notification_days_ahead}
                onChange={(e) => setFormData({ ...formData, notification_days_ahead: parseInt(e.target.value) || 3 })}
                helperText="Días antes del concurso para enviar notificación"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                  }
                  label="Alerta Activa"
                />
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmitAlert}
            variant="contained"
            disabled={!formData.title}
          >
            {selectedAlert ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications Detail Dialog */}
      <Dialog open={notificationDialogOpen} onClose={() => setNotificationDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Historial de Notificaciones
        </DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Alerta</TableCell>
                  <TableCell>Concurso</TableCell>
                  <TableCell>Fecha Envío</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Reenviar</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notificationsData?.notifications?.map((notification: any) => (
                  <TableRow key={notification.id}>
                    <TableCell>{notification.id}</TableCell>
                    <TableCell>{notification.user_id}</TableCell>
                    <TableCell>{notification.alert_id}</TableCell>
                    <TableCell>{notification.contest_title}</TableCell>
                    <TableCell>{format(new Date(notification.sent_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <Chip
                        label={notification.status}
                        color={notification.status === 'sent' ? 'success' : notification.status === 'failed' ? 'error' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {notification.status === 'failed' && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => console.log('Reenviar notificación:', notification.id)}
                        >
                          Reenviar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotificationDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AlertManagement;
