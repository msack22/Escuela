import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  School as SchoolIcon,
  Event as EventIcon,
  NotificationsActive as NotificationIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';

import {
  fetchContests,
  fetchAlerts,
  fetchScrapingStatus,
  fetchContestStatistics,
  fetchSystemStatus,
} from '../../services/api.ts';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="h6">
            {title}
          </Typography>
          <Typography variant="h4" component="h2" style={{ color }}>
            {value}
          </Typography>
        </Box>
        <Box style={{ color, fontSize: 40 }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

  const {
    data: statistics,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery('contestStatistics', fetchContestStatistics, {
    refetchInterval: 60000, // Refetch every minute
  });

  const {
    data: systemStatus,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery('systemStatus', fetchSystemStatus, {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    if (statsError || statusError) {
      setError('Error loading dashboard data');
    }
  }, [statsError, statusError]);

  if (statsLoading || statusLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Concursos"
            value={statistics?.total_contests || 0}
            icon={<EventIcon />}
            color="#1976d2"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Concursos Activos"
            value={statistics?.active_contests || 0}
            icon={<TrendingIcon />}
            color="#4caf50"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Escuelas"
            value={statistics?.total_schools || 0}
            icon={<SchoolIcon />}
            color="#ff9800"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Materias"
            value={statistics?.total_subjects || 0}
            icon={<NotificationIcon />}
            color="#9c27b0"
          />
        </Grid>

        {/* System Status */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Estado del Sistema
            </Typography>
            <Box>
              <Typography variant="body1">
                <strong>API Status:</strong> {systemStatus?.api_status || 'Unknown'}
              </Typography>
              <Typography variant="body1">
                <strong>Scheduler:</strong> {systemStatus?.scheduler?.is_running ? 'Running' : 'Stopped'}
              </Typography>
              <Typography variant="body1">
                <strong>Database:</strong> {systemStatus?.database || 'Unknown'}
              </Typography>
              <Typography variant="body1">
                <strong>Scraping Interval:</strong> {systemStatus?.scheduler?.interval_hours || 2} hours
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Fuentes Disponibles
            </Typography>
            <Box>
              {systemStatus?.scheduler?.available_sources?.map((source: string, index: number) => (
                <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                  • {source}
                </Typography>
              )) || <Typography variant="body2">No sources available</Typography>}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
