import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns/format';

import {
  fetchScrapingStatus,
  fetchSystemStatus,
  triggerManualScraping,
  runManualScraping,
  startScheduler,
  stopScheduler,
  fetchScrapingLogs,
} from '../../services/api.ts';

const ScrapingStatus: React.FC = () => {
  const [selectedSource, setSelectedSource] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'start' | 'stop' | null>(null);

  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery(
    'scrapingStatus',
    fetchScrapingStatus,
    { refetchInterval: 30000 } // Refetch every 30 seconds
  );

  const { data: logsData, isLoading: logsLoading } = useQuery(
    'scrapingLogs',
    () => fetchScrapingLogs(50),
    { refetchInterval: 60000 } // Refetch every minute
  );

  const manualScrapingMutation = useMutation(runManualScraping, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('scrapingLogs');
      alert(`Scraping completado: ${data.total_contests_found} concursos encontrados`);
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Error al ejecutar scraping manual');
    },
  });

  const startSchedulerMutation = useMutation(startScheduler, {
    onSuccess: () => {
      queryClient.invalidateQueries('scrapingStatus');
      alert('Scheduler iniciado correctamente');
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Error al iniciar scheduler');
    },
  });

  const stopSchedulerMutation = useMutation(stopScheduler, {
    onSuccess: () => {
      queryClient.invalidateQueries('scrapingStatus');
      alert('Scheduler detenido correctamente');
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Error al detener scheduler');
    },
  });

  const handleManualScraping = () => {
    manualScrapingMutation.mutate(selectedSource || undefined);
  };

  const handleStartScheduler = () => {
    setConfirmAction('start');
    setConfirmDialogOpen(true);
  };

  const handleStopScheduler = () => {
    setConfirmAction('stop');
    setConfirmDialogOpen(true);
  };

  const executeConfirmAction = () => {
    if (confirmAction === 'start') {
      startSchedulerMutation.mutate();
    } else if (confirmAction === 'stop') {
      stopSchedulerMutation.mutate();
    }
    setConfirmDialogOpen(false);
    setConfirmAction(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'running':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Estado del Sistema de Scraping
      </Typography>

      {/* Status Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Estado del Scheduler
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Chip
                  label={status?.is_running ? 'En ejecución' : 'Detenido'}
                  color={status?.is_running ? 'success' : 'default'}
                />
                <Typography variant="body2">
                  Intervalo: {status?.interval_hours || 2} horas
                </Typography>
              </Box>
              <Box display="flex" gap={1}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<PlayIcon />}
                  onClick={handleStartScheduler}
                  disabled={status?.is_running || startSchedulerMutation.isLoading}
                  size="small"
                >
                  Iniciar
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={handleStopScheduler}
                  disabled={!status?.is_running || stopSchedulerMutation.isLoading}
                  size="small"
                >
                  Detener
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Scraping Manual
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Fuente</InputLabel>
                  <Select
                    value={selectedSource}
                    label="Fuente"
                    onChange={(e) => setSelectedSource(e.target.value)}
                  >
                    <MenuItem value="">Todas las fuentes</MenuItem>
                    {status?.all_sources?.map((source: string) => (
                      <MenuItem key={source} value={source}>
                        {source}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={handleManualScraping}
                disabled={manualScrapingMutation.isLoading}
                fullWidth
              >
                {manualScrapingMutation.isLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  'Ejecutar Scraping'
                )}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sources Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Estado de Fuentes
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Fuentes Disponibles:
              </Typography>
              {status?.available_sources?.map((source: string, index: number) => (
                <Chip
                  key={index}
                  label={source}
                  color="success"
                  size="small"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Todas las Fuentes:
              </Typography>
              {status?.all_sources?.map((source: string, index: number) => (
                <Chip
                  key={index}
                  label={source}
                  color={status?.available_sources?.includes(source) ? 'success' : 'default'}
                  size="small"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Logs de Ejecución
          </Typography>
          
          {logsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fuente</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Concursos Encontrados</TableCell>
                    <TableCell>Concursos Procesados</TableCell>
                    <TableCell>Tiempo de Ejecución</TableCell>
                    <TableCell>Fecha</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logsData?.logs?.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.source_name}</TableCell>
                      <TableCell>
                        <Chip
                          label={log.status}
                          color={getStatusColor(log.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{log.contests_found}</TableCell>
                      <TableCell>{log.contests_processed}</TableCell>
                      <TableCell>
                        {log.execution_time_seconds
                          ? `${log.execution_time_seconds.toFixed(2)}s`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {log.started_at
                          ? format(new Date(log.started_at), 'dd/MM/yyyy HH:mm:ss')
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirmar Acción</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de que quieres {confirmAction === 'start' ? 'iniciar' : 'detener'} el scheduler?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancelar</Button>
          <Button onClick={executeConfirmAction} variant="contained">
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScrapingStatus;
