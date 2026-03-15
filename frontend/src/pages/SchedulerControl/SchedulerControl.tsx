import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { 
  getSchedulerStatus, 
  startScheduler, 
  stopScheduler, 
  runScrapingOnce, 
  restartScheduler,
  getActiveJobs 
} from '../../services/api';

interface SchedulerStatus {
  is_running: boolean;
  last_run: string | null;
  next_run: string | null;
  available_sources: string[];
  job_count: number;
}

interface JobRequest {
  source?: string;
  force?: boolean;
}

const SchedulerControl: React.FC = () => {
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [forceRun, setForceRun] = useState<boolean>(false);

  const queryClient = useQueryClient();

  // Queries
  const { data: schedulerStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['schedulerStatus'],
    queryFn: getSchedulerStatus,
    refetchInterval: 5000, // Refrescar cada 5 segundos
  });

  const { data: activeJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['activeJobs'],
    queryFn: getActiveJobs,
    refetchInterval: 3000, // Refrescar cada 3 segundos
  });

  // Mutations
  const startMutation = useMutation({
    mutationFn: startScheduler,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulerStatus'] });
      queryClient.invalidateQueries({ queryKey: ['activeJobs'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: stopScheduler,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulerStatus'] });
      queryClient.invalidateQueries({ queryKey: ['activeJobs'] });
    },
  });

  const runOnceMutation = useMutation({
    mutationFn: (data: JobRequest) => runScrapingOnce(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulerStatus'] });
      queryClient.invalidateQueries({ queryKey: ['activeJobs'] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: restartScheduler,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulerStatus'] });
      queryClient.invalidateQueries({ queryKey: ['activeJobs'] });
    },
  });

  const handleStart = () => {
    startMutation.mutate();
  };

  const handleStop = () => {
    stopMutation.mutate();
  };

  const handleRunOnce = () => {
    runOnceMutation.mutate({ source: selectedSource, force: forceRun });
  };

  const handleRestart = () => {
    restartMutation.mutate();
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (isRunning: boolean) => {
    return isRunning ? 'success' : 'default';
  };

  const getStatusIcon = (isRunning: boolean) => {
    return isRunning ? <ScheduleIcon color="success" /> : <ScheduleIcon color="disabled" />;
  };

  if (statusLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Cargando estado del scheduler...
        </Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        ⚙️ Control del Scheduler
      </Typography>

      <Grid container spacing={3}>
        {/* Estado Principal */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 Estado del Scheduler
              </Typography>
              
              <Box display="flex" alignItems="center" mb={2}>
                {getStatusIcon(schedulerStatus?.is_running || false)}
                <Typography variant="body1" sx={{ ml: 1 }}>
                  Estado: <Chip 
                    label={schedulerStatus?.is_running ? 'En ejecución' : 'Detenido'} 
                    color={getStatusColor(schedulerStatus?.is_running || false)}
                    size="small"
                  />
                </Typography>
              </Box>

              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <ScheduleIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Última ejecución" 
                    secondary={formatDateTime(schedulerStatus?.last_run || null)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <ScheduleIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Próxima ejecución" 
                    secondary={formatDateTime(schedulerStatus?.next_run || null)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <InfoIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Jobs activos" 
                    secondary={`${activeJobs?.count || 0} jobs corriendo`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Control de Scheduler */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🎮 Control del Scheduler
              </Typography>
              
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<PlayIcon />}
                  onClick={handleStart}
                  disabled={schedulerStatus?.is_running || startMutation.isPending}
                  fullWidth
                >
                  {startMutation.isPending ? 'Iniciando...' : 'Iniciar Scheduler'}
                </Button>

                <Button
                  variant="contained"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={handleStop}
                  disabled={!schedulerStatus?.is_running || stopMutation.isPending}
                  fullWidth
                >
                  {stopMutation.isPending ? 'Deteniendo...' : 'Detener Scheduler'}
                </Button>

                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<RefreshIcon />}
                  onClick={handleRestart}
                  disabled={restartMutation.isPending}
                  fullWidth
                >
                  {restartMutation.isPending ? 'Reiniciando...' : 'Reiniciar Scheduler'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Ejecución Manual */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🚀 Ejecución Manual
              </Typography>
              
              <Box display="flex" flexDirection="column" gap={2}>
                {schedulerStatus?.available_sources && schedulerStatus.available_sources.length > 0 && (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Fuente de scraping:
                    </Typography>
                    <select
                      value={selectedSource}
                      onChange={(e) => setSelectedSource(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ccc'
                      }}
                    >
                      <option value="">Todas las fuentes</option>
                      {schedulerStatus.available_sources.map((source) => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </select>
                  </Box>
                )}

                <Box display="flex" alignItems="center" gap={1}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={forceRun}
                        onChange={(e) => setForceRun(e.target.checked)}
                      />
                    }
                    label="Forzar ejecución"
                  />
                  <Tooltip title="Ignora caché y ejecuta aunque se haya ejecutado recientemente">
                    <InfoIcon fontSize="small" color="action" />
                  </Tooltip>
                </Box>

                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayIcon />}
                  onClick={handleRunOnce}
                  disabled={runOnceMutation.isPending}
                  fullWidth
                >
                  {runOnceMutation.isPending ? 'Ejecutando...' : 'Ejecutar una vez'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Jobs Activos */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📋 Jobs Activos
              </Typography>
              
              {jobsLoading ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : activeJobs?.active_jobs && activeJobs.active_jobs.length > 0 ? (
                <List dense>
                  {activeJobs.active_jobs.map((job: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CircularProgress size={20} />
                      </ListItemIcon>
                      <ListItemText 
                        primary={job.name || `Job ${index + 1}`}
                        secondary={`Iniciado: ${formatDateTime(job.start_time)}`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box display="flex" alignItems="center" p={2}>
                  <InfoIcon color="action" />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    No hay jobs activos actualmente
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alertas de estado */}
      {startMutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Error al iniciar el scheduler: {startMutation.error?.message || 'Error desconocido'}
        </Alert>
      )}

      {stopMutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Error al detener el scheduler: {stopMutation.error?.message || 'Error desconocido'}
        </Alert>
      )}

      {runOnceMutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Error al ejecutar scraping: {runOnceMutation.error?.message || 'Error desconocido'}
        </Alert>
      )}

      {restartMutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Error al reiniciar el scheduler: {restartMutation.error?.message || 'Error desconocido'}
        </Alert>
      )}

      {runOnceMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          ✅ Scraping iniciado exitosamente
        </Alert>
      )}

      {startMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          ✅ Scheduler iniciado exitosamente
        </Alert>
      )}

      {stopMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          ✅ Scheduler detenido exitosamente
        </Alert>
      )}

      {restartMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          ✅ Scheduler reiniciado exitosamente
        </Alert>
      )}
    </Box>
  );
};

export default SchedulerControl;
