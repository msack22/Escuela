import React, { useState, useEffect } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Alert as MuiAlert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  fetchUsers,
  fetchUserAlerts,
  fetchUserContestNotifications,
  createUser,
  updateUser,
  deleteUser,
} from '../../services/api';

// Interfaces
interface User {
  id: number;
  username: string;
  email: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
  alert_count?: number;
}

interface UserAlert {
  id: number;
  user_name: string;
  whatsapp_number: string;
  subject_preferences: string[];
  max_distance_km: number;
  created_at: string;
  is_active: boolean;
}

interface ContestNotification {
  id: number;
  user_id: number;
  contest_id: number;
  contest_title: string;
  school_name: string;
  subject_name: string;
  sent_at: string;
  contest_date: string;
}

// Componente de tabla de usuarios
const UsersTable = ({ users, onEdit, onDelete }: {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (userId: number) => void;
}) => {
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Usuario</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Teléfono</TableCell>
            <TableCell>Alertas</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell>Creado</TableCell>
            <TableCell>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <PersonIcon fontSize="small" />
                  {user.username}
                </Box>
              </TableCell>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <EmailIcon fontSize="small" />
                  {user.email}
                </Box>
              </TableCell>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <PhoneIcon fontSize="small" />
                  {user.phone_number}
                </Box>
              </TableCell>
              <TableCell>
                <Chip 
                  label={user.alert_count || 0} 
                  color={user.alert_count > 0 ? 'primary' : 'default'}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Chip 
                  label={user.is_active ? 'Activo' : 'Inactivo'}
                  color={user.is_active ? 'success' : 'error'}
                  size="small"
                />
              </TableCell>
              <TableCell>
                {new Date(user.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Box display="flex" gap={1}>
                  <Tooltip title="Ver alertas del usuario">
                    <IconButton
                      size="small"
                      onClick={() => onEdit(user)}
                    >
                      <NotificationsIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar usuario">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(user.id)}
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
  );
};

// Componente de tabla de notificaciones enviadas
const ContestNotificationsTable = ({ notifications }: {
  notifications: ContestNotification[];
}) => {
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Usuario</TableCell>
            <TableCell>Concurso</TableCell>
            <TableCell>Escuela</TableCell>
            <TableCell>Materia</TableCell>
            <TableCell>Fecha Concurso</TableCell>
            <TableCell>Enviado</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {notifications.map((notification) => (
            <TableRow key={notification.id}>
              <TableCell>{notification.user_id}</TableCell>
              <TableCell>{notification.contest_title}</TableCell>
              <TableCell>{notification.school_name}</TableCell>
              <TableCell>{notification.subject_name}</TableCell>
              <TableCell>{notification.contest_date}</TableCell>
              <TableCell>{new Date(notification.sent_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const UserManagement: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone_number: '',
    is_active: true,
  });

  const queryClient = useQueryClient();

  // Queries
  const { data: users, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const { data: userAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['userAlerts', selectedUser?.id],
    queryFn: () => selectedUser ? fetchUserAlerts(selectedUser.id) : [],
    enabled: !!selectedUser,
  });

  const { data: contestNotifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['contestNotifications', selectedUser?.id],
    queryFn: () => selectedUser ? fetchUserContestNotifications(selectedUser.id) : [],
    enabled: !!selectedUser,
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpenUserDialog(false);
      resetForm();
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpenUserDialog(false);
      setSelectedUser(null);
      resetForm();
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedUser(null);
    },
  });

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      phone_number: '',
      is_active: true,
    });
  };

  const handleCreateUser = () => {
    setDialogMode('create');
    resetForm();
    setOpenUserDialog(true);
  };

  const handleEditUser = (user: User) => {
    setDialogMode('edit');
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      phone_number: user.phone_number,
      is_active: user.is_active,
    });
    setOpenUserDialog(true);
  };

  const handleDeleteUser = (userId: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dialogMode === 'create') {
      createUserMutation.mutate(formData);
    } else {
      updateUserMutation.mutate({ id: selectedUser!.id, data: formData });
    }
  };

  if (usersLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Cargando usuarios...
        </Typography>
      </Box>
    );
  }

  if (usersError) {
    return (
      <Box p={3}>
        <MuiAlert severity="error">
          Error al cargar usuarios: {usersError.message}
        </MuiAlert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        👥 Gestión de Usuarios y Notificaciones
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="👥 Usuarios" />
          <Tab label="📧 Alertas Configuradas" />
          <Tab label="📨 Notificaciones Enviadas" />
        </Tabs>
      </Box>

      {/* Tab de Usuarios */}
      {tabValue === 0 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Lista de Usuarios ({users?.length || 0})
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateUser}
            >
              Nuevo Usuario
            </Button>
          </Box>

          <UsersTable
            users={users || []}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
          />
        </Box>
      )}

      {/* Tab de Alertas del Usuario Seleccionado */}
      {tabValue === 1 && selectedUser && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Alertas de: {selectedUser.username}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => handleEditUser(selectedUser)}
            >
              Editar Usuario
            </Button>
          </Box>

          {alertsLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Teléfono</TableCell>
                    <TableCell>Materias</TableCell>
                    <TableCell>Distancia Máxima</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Creado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userAlerts?.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>{alert.user_name}</TableCell>
                      <TableCell>{alert.whatsapp_number}</TableCell>
                      <TableCell>
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {alert.subject_preferences.map((subject) => (
                            <Chip key={subject} label={subject} size="small" />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>{alert.max_distance_km} km</TableCell>
                      <TableCell>
                        <Chip 
                          label={alert.is_active ? 'Activa' : 'Inactiva'}
                          color={alert.is_active ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{new Date(alert.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Tab de Notificaciones Enviadas */}
      {tabValue === 2 && selectedUser && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Notificaciones Enviadas a: {selectedUser.username}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Total: {contestNotifications?.length || 0} notificaciones
            </Typography>
          </Box>

          {notificationsLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <ContestNotificationsTable notifications={contestNotifications || []} />
          )}
        </Box>
      )}

      {/* Diálogo para crear/editar usuario */}
      <Dialog open={openUserDialog} onClose={() => setOpenUserDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? 'Crear Nuevo Usuario' : 'Editar Usuario'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} pt={1}>
              <TextField
                label="Usuario"
                name="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Teléfono"
                name="phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                fullWidth
                required
              />
              <FormControl fullWidth>
                <InputLabel>Estado</InputLabel>
                <Select
                  value={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                >
                  <MenuItem value={true}>Activo</MenuItem>
                  <MenuItem value={false}>Inactivo</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenUserDialog(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" color="primary">
              {dialogMode === 'create' ? 'Crear' : 'Actualizar'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default UserManagement;
