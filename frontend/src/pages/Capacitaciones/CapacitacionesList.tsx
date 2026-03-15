import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Event,
  LocationOn,
  School,
  AttachMoney,
  Timer,
  Star,
  Launch,
  FilterList,
  Refresh,
} from '@mui/icons-material';
import { format } from 'date-fns/format';
import { es } from 'date-fns/locale/es';

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

interface CapacitacionesListProps {
  capacitaciones: Capacitacion[];
  loading: boolean;
  onRefresh: () => void;
  onScrape: () => void;
}

const CapacitacionesList: React.FC<CapacitacionesListProps> = ({
  capacitaciones,
  loading,
  onRefresh,
  onScrape,
}) => {
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCapacitacion, setSelectedCapacitacion] = useState<Capacitacion | null>(null);
  const [filters, setFilters] = useState({
    nivel_educativo: '',
    modalidad: '',
    ciudad: '',
    precio_min: 0,
    precio_max: 10000,
    con_puntaje: false,
  });

  const itemsPerPage = 12;
  const totalPages = Math.ceil(capacitaciones.length / itemsPerPage);
  // const currentItems = capacitaciones.slice(
  //   (page - 1) * itemsPerPage,
  //   page * itemsPerPage
  // );

  const handleFilterChange = (field: string, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const getModalidadColor = (modalidad?: string) => {
    switch (modalidad?.toLowerCase()) {
      case 'virtual':
        return 'primary';
      case 'presencial':
        return 'success';
      case 'híbrido':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getNivelColor = (nivel?: string) => {
    switch (nivel?.toLowerCase()) {
      case 'inicial':
        return 'info';
      case 'primario':
        return 'success';
      case 'secundario':
        return 'warning';
      case 'superior':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatPrice = (precio?: number, moneda?: string) => {
    if (precio === 0) return 'Gratis';
    if (!precio) return 'Consultar';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: moneda || 'ARS',
    }).format(precio);
  };

  const filteredCapacitaciones = capacitaciones.filter(cap => {
    if (filters.nivel_educativo && cap.nivel_educativo !== filters.nivel_educativo) return false;
    if (filters.modalidad && cap.modalidad !== filters.modalidad) return false;
    if (filters.ciudad && cap.ciudad !== filters.ciudad) return false;
    if (filters.precio_min && (cap.precio || 0) < filters.precio_min) return false;
    if (filters.precio_max && (cap.precio || 0) > filters.precio_max) return false;
    if (filters.con_puntaje && !cap.puntaje_asignado) return false;
    return true;
  });

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Capacitaciones y Cursos
        </Typography>
        <Box>
          <IconButton onClick={() => setFiltersOpen(true)} color="primary">
            <FilterList />
          </IconButton>
          <IconButton onClick={onRefresh} color="primary">
            <Refresh />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={onScrape}
            sx={{ ml: 1 }}
          >
            Actualizar Datos
          </Button>
        </Box>
      </Box>

      {/* Filters Dialog */}
      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Filtros</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Nivel Educativo</InputLabel>
              <Select
                value={filters.nivel_educativo}
                onChange={(e) => handleFilterChange('nivel_educativo', e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="Inicial">Inicial</MenuItem>
                <MenuItem value="Primario">Primario</MenuItem>
                <MenuItem value="Secundario">Secundario</MenuItem>
                <MenuItem value="Superior">Superior</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Modalidad</InputLabel>
              <Select
                value={filters.modalidad}
                onChange={(e) => handleFilterChange('modalidad', e.target.value)}
              >
                <MenuItem value="">Todas</MenuItem>
                <MenuItem value="Virtual">Virtual</MenuItem>
                <MenuItem value="Presencial">Presencial</MenuItem>
                <MenuItem value="Híbrido">Híbrido</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Ciudad"
              value={filters.ciudad}
              onChange={(e) => handleFilterChange('ciudad', e.target.value)}
              fullWidth
            />

            <Typography gutterBottom>Rango de Precio</Typography>
            <Slider
              value={[filters.precio_min, filters.precio_max]}
              onChange={(_, value) => {
                handleFilterChange('precio_min', value[0]);
                handleFilterChange('precio_max', value[1]);
              }}
              valueLabelDisplay="auto"
              min={0}
              max={10000}
              step={100}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={filters.con_puntaje}
                  onChange={(e) => handleFilterChange('con_puntaje', e.target.checked)}
                />
              }
              label="Solo con puntaje asignado"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFiltersOpen(false)}>Cancelar</Button>
          <Button onClick={() => setFiltersOpen(false)} variant="contained">
            Aplicar Filtros
          </Button>
        </DialogActions>
      </Dialog>

      {/* Capacitaciones Grid */}
      <Grid container spacing={3}>
        {filteredCapacitaciones.map((capacitacion) => (
          <Grid item xs={12} sm={6} md={4} key={capacitacion.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                {/* Header */}
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                    {capacitacion.titulo}
                  </Typography>
                  {capacitacion.puntaje_asignado && (
                    <Chip
                      icon={<Star />}
                      label={`+${capacitacion.puntaje_asignado} pts`}
                      size="small"
                      color="primary"
                    />
                  )}
                </Box>

                {/* Institución */}
                {capacitacion.institucion && (
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    <School sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    {capacitacion.institucion}
                  </Typography>
                )}

                {/* Descripción */}
                {capacitacion.descripcion && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {capacitacion.descripcion}
                  </Typography>
                )}

                {/* Chips */}
                <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                  {capacitacion.modalidad && (
                    <Chip
                      label={capacitacion.modalidad}
                      size="small"
                      color={getModalidadColor(capacitacion.modalidad)}
                    />
                  )}
                  {capacitacion.nivel_educativo && (
                    <Chip
                      label={capacitacion.nivel_educativo}
                      size="small"
                      color={getNivelColor(capacitacion.nivel_educativo)}
                    />
                  )}
                  {capacitacion.beca_disponible && (
                    <Chip label="Beca disponible" size="small" color="success" />
                  )}
                </Box>

                {/* Detalles */}
                <Box display="flex" flexDirection="column" gap={1}>
                  {capacitacion.fecha_inicio && (
                    <Typography variant="body2" color="text.secondary">
                      <Event sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      Inicio: {format(new Date(capacitacion.fecha_inicio), 'dd MMM yyyy', { locale: es })}
                    </Typography>
                  )}

                  {capacitacion.fecha_limite_inscripcion && (
                    <Typography variant="body2" color="text.secondary">
                      <Timer sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      Inscripción hasta: {format(new Date(capacitacion.fecha_limite_inscripcion), 'dd MMM yyyy', { locale: es })}
                    </Typography>
                  )}

                  {capacitacion.ciudad && (
                    <Typography variant="body2" color="text.secondary">
                      <LocationOn sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      {capacitacion.ciudad}, {capacitacion.provincia}
                    </Typography>
                  )}

                  <Typography variant="body2" color="primary" fontWeight="bold">
                    <AttachMoney sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    {formatPrice(capacitacion.precio, capacitacion.moneda)}
                  </Typography>

                  {capacitacion.horas_catedra && (
                    <Typography variant="body2" color="text.secondary">
                      <Timer sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      {capacitacion.horas_catedra} horas cátedra
                    </Typography>
                  )}
                </Box>
              </CardContent>

              {/* Actions */}
              <Box sx={{ p: 2, pt: 0 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setSelectedCapacitacion(capacitacion)}
                  sx={{ mr: 1 }}
                >
                  Ver Detalles
                </Button>
                {capacitacion.url_inscripcion && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Launch />}
                    href={capacitacion.url_inscripcion}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Inscribirse
                  </Button>
                )}
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
          />
        </Box>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedCapacitacion}
        onClose={() => setSelectedCapacitacion(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedCapacitacion && (
          <>
            <DialogTitle>{selectedCapacitacion.titulo}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6">Información General</Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Institución: {selectedCapacitacion.institucion || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Modalidad: {selectedCapacitacion.modalidad || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Duración: {selectedCapacitacion.duracion || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Certificado: {selectedCapacitacion.tipo_certificado || 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>

                {selectedCapacitacion.descripcion && (
                  <>
                    <Typography variant="h6">Descripción</Typography>
                    <Typography variant="body1">
                      {selectedCapacitacion.descripcion}
                    </Typography>
                  </>
                )}

                {selectedCapacitacion.destinatarios && (
                  <>
                    <Typography variant="h6">Destinatarios</Typography>
                    <Typography variant="body1">
                      {selectedCapacitacion.destinatarios}
                    </Typography>
                  </>
                )}

                <Typography variant="h6">Contacto</Typography>
                <Grid container spacing={2}>
                  {selectedCapacitacion.email_contacto && (
                    <Grid item xs={12}>
                      <Typography variant="body2">
                        Email: {selectedCapacitacion.email_contacto}
                      </Typography>
                    </Grid>
                  )}
                  {selectedCapacitacion.telefono_contacto && (
                    <Grid item xs={12}>
                      <Typography variant="body2">
                        Teléfono: {selectedCapacitacion.telefono_contacto}
                      </Typography>
                    </Grid>
                  )}
                  {selectedCapacitacion.direccion && (
                    <Grid item xs={12}>
                      <Typography variant="body2">
                        Dirección: {selectedCapacitacion.direccion}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedCapacitacion(null)}>Cerrar</Button>
              {selectedCapacitacion.url_inscripcion && (
                <Button
                  variant="contained"
                  startIcon={<Launch />}
                  href={selectedCapacitacion.url_inscripcion}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ir a Inscripción
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default CapacitacionesList;
