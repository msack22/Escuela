import React from 'react';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';

const CapacitacionesPage: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleScrape = async () => {
    setLoading(true);
    setError(null);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box mb={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Capacitaciones y Cursos
        </Typography>
        <Box>
          <Button
            variant="outlined"
            onClick={handleRefresh}
            sx={{ mr: 1 }}
          >
            Refrescar
          </Button>
          <Button
            variant="contained"
            onClick={handleScrape}
          >
            Actualizar Datos
          </Button>
        </Box>
      </Box>

      <Typography variant="body1">
        Página de capacitaciones funcionando correctamente. 
        Los componentes serán integrados pronto.
      </Typography>
    </Box>
  );
};

export default CapacitacionesPage;
