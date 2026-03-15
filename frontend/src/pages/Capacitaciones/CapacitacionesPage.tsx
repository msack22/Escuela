import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import CapacitacionesList from './CapacitacionesList';
import { fetchCapacitaciones, scrapeCapacitaciones } from '../../services/api';

interface Capacitacion {
  id: number;
  titulo: string;
  descripcion?: string;
  institucion?: string;
  modalidad?: string;
  duracion?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  fecha_limite_inscripcion?: string;
  precio?: number;
  moneda?: string;
  beca_disponible?: boolean;
  puntaje_asignado?: number;
  tipo_certificado?: string;
  horas_catedra?: number;
  url_inscripcion?: string;
  email_contacto?: string;
  telefono_contacto?: string;
  provincia?: string;
  ciudad?: string;
  direccion?: string;
  nivel_educativo?: string;
  destinatarios?: string;
  fuente: string;
  url_fuente?: string;
  fecha_scraping: string;
  activa: boolean;
}

const CapacitacionesPage: React.FC = () => {
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCapacitaciones = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCapacitaciones();
      setCapacitaciones(data);
    } catch (err) {
      setError('Error al cargar las capacitaciones');
      console.error('Error loading capacitaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async () => {
    try {
      await scrapeCapacitaciones();
      await loadCapacitaciones(); // Reload data after scraping
    } catch (err) {
      setError('Error al actualizar los datos');
      console.error('Error scraping capacitaciones:', err);
    }
  };

  useEffect(() => {
    loadCapacitaciones();
  }, []);

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
    <CapacitacionesList
      capacitaciones={capacitaciones}
      loading={loading}
      onRefresh={loadCapacitaciones}
      onScrape={handleScrape}
    />
  );
};

export default CapacitacionesPage;
