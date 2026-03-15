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
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  OpenInNew as OpenInNewIcon,
  LocationOn as LocationIcon,
  Info as InfoIcon,
  Source as SourceIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import {
  fetchContests,
  fetchSchools,
  fetchSubjects,
  fetchLevels,
  fetchShifts,
  fetchContractTypes,
  fetchCities,
  fetchDepartments,
} from '../../services/api';

const ContestList: React.FC = () => {
  const [filters, setFilters] = useState({
    title_contains: '',
    subject_ids: [],
    cities: [],
    departments: [],
    date_from: '',
    date_to: '',
    is_active: true,
  });

  const [selectedContest, setSelectedContest] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 20,
  });

  const {
    data: contestsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['contests', filters, pagination],
    queryFn: () => fetchContests({ ...filters, ...pagination }),
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: fetchSubjects,
  });
  const { data: citiesData } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
  });
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  const handleFilterChange = (field: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
    setPagination(prev => ({ ...prev, skip: 0 })); // Reset to first page
  };

  const handleClearFilters = () => {
    setFilters({
      title_contains: '',
      subject_ids: [],
      cities: [],
      departments: [],
      date_from: '',
      date_to: '',
      is_active: true,
    });
    setPagination({ skip: 0, limit: 20 });
  };

  const handleLastWeekFilter = () => {
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    setFilters(prev => ({
      ...prev,
      date_from: oneWeekAgo.toISOString().split('T')[0],
      date_to: today.toISOString().split('T')[0],
    }));
    setPagination(prev => ({ ...prev, skip: 0 })); // Reset to first page
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const newSkip = (value - 1) * pagination.limit;
    setPagination(prev => ({ ...prev, skip: newSkip }));
  };

  const totalPages = Math.ceil((contestsData?.total || 0) / pagination.limit);
  const currentPage = Math.floor(pagination.skip / pagination.limit) + 1;

  const handleOpenDetail = (contest: any) => {
    setSelectedContest(contest);
    setDetailDialogOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailDialogOpen(false);
    setSelectedContest(null);
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error loading contests: {error instanceof Error ? error.message : 'Unknown error'}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Concursos Educativos
      </Typography>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filtros de Búsqueda
          </Typography>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Buscar por título"
                value={filters.title_contains}
                onChange={(e) => handleFilterChange('title_contains', e.target.value)}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={() => handleFilterChange('title_contains', '')}>
                      <ClearIcon />
                    </IconButton>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Materias</InputLabel>
                <Select
                  multiple
                  value={filters.subject_ids}
                  label="Materias"
                  onChange={(e) => handleFilterChange('subject_ids', e.target.value)}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value: any) => (
                        <Chip key={value} label={subjects && Array.isArray(subjects) ? subjects.find((s: any) => s.id === value)?.name || value : value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  <MenuItem value="">
                    <em>Todas</em>
                  </MenuItem>
                  {subjects?.map((subject: any) => (
                    <MenuItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Ciudades</InputLabel>
                <Select
                  multiple
                  value={filters.cities}
                  label="Ciudades"
                  onChange={(e) => handleFilterChange('cities', e.target.value)}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value: any) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  <MenuItem value="">
                    <em>Todas</em>
                  </MenuItem>
                  {citiesData?.cities?.map((city: string) => (
                    <MenuItem key={city} value={city}>
                      {city}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Departamentos</InputLabel>
                <Select
                  multiple
                  value={filters.departments}
                  label="Departamentos"
                  onChange={(e) => handleFilterChange('departments', e.target.value)}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value: any) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  <MenuItem value="">
                    <em>Todos</em>
                  </MenuItem>
                  {departmentsData?.departments?.map((dept: string) => (
                    <MenuItem key={dept} value={dept}>
                      {dept}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Fecha desde"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Fecha hasta"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box display="flex" gap={1}>
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={() => refetch()}
                  fullWidth
                >
                  Buscar
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                >
                  Limpiar
                </Button>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleLastWeekFilter}
                fullWidth
              >
                Última Semana
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Resultados ({contestsData?.total || 0} concursos encontrados)
            </Typography>
          </Box>

          {isLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Título</TableCell>
                    <TableCell>Materia</TableCell>
                    <TableCell>Escuela</TableCell>
                    <TableCell>Ciudad</TableCell>
                    <TableCell>Fecha Publicación</TableCell>
                    <TableCell>Fecha Concurso</TableCell>
                    <TableCell>Fuente</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contestsData?.contests?.map((contest: any) => (
                    <TableRow key={contest.id} hover className="contest-card">
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {contest.title}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {contest.description?.substring(0, 100)}...
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={contest.subject.name}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {contest.school.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <LocationIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {contest.school.city}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CalendarIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {contest.publication_date
                              ? format(new Date(contest.publication_date), 'dd/MM/yyyy')
                              : 'No especificada'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {contest.date
                            ? format(new Date(contest.date), 'dd/MM/yyyy HH:mm')
                            : 'No especificada'}
                        </Typography>
                        {contest.registration_deadline && (
                          <Typography variant="caption" color="textSecondary">
                            Cierre: {format(new Date(contest.registration_deadline), 'dd/MM/yyyy')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <SourceIcon fontSize="small" color="action" />
                          <Chip
                            label={contest.source_name}
                            size="small"
                            color={contest.source_name === 'Facebook' ? 'primary' : 'secondary'}
                            variant="outlined"
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={contest.is_active ? 'Activo' : 'Inactivo'}
                          size="small"
                          color={contest.is_active ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Tooltip title="Ver detalle completo">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDetail(contest)}
                              color="primary"
                            >
                              <InfoIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Ver fuente original">
                            <IconButton
                              size="small"
                              onClick={() => window.open(contest.source_url, '_blank')}
                            >
                              <OpenInNewIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={handleCloseDetail}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6">Detalle del Concurso</Typography>
        </DialogTitle>
        <DialogContent>
          {selectedContest && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  {selectedContest.title}
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  {selectedContest.description}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="primary">
                  Escuela
                </Typography>
                <Typography variant="body2">
                  {selectedContest.school.name}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {selectedContest.school.city}, {selectedContest.school.department}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="primary">
                  Materia
                </Typography>
                <Chip
                  label={selectedContest.subject.name}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="primary">
                  Fecha del Concurso
                </Typography>
                <Typography variant="body2">
                  {selectedContest.date
                    ? format(new Date(selectedContest.date), 'dd/MM/yyyy HH:mm')
                    : 'No especificada'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="primary">
                  Fecha de Publicación
                </Typography>
                <Typography variant="body2">
                  {selectedContest.publication_date
                    ? format(new Date(selectedContest.publication_date), 'dd/MM/yyyy')
                    : 'No especificada'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="primary">
                  Fuente
                </Typography>
                <Chip
                  label={selectedContest.source_name}
                  size="small"
                  color={selectedContest.source_name === 'Facebook' ? 'primary' : 'secondary'}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="primary">
                  Estado
                </Typography>
                <Chip
                  label={selectedContest.is_active ? 'Activo' : 'Inactivo'}
                  size="small"
                  color={selectedContest.is_active ? 'success' : 'default'}
                />
              </Grid>
              
              {selectedContest.level && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="primary">
                    Nivel
                  </Typography>
                  <Typography variant="body2">
                    {selectedContest.level}
                  </Typography>
                </Grid>
              )}
              
              {selectedContest.shift && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="primary">
                    Turno
                  </Typography>
                  <Typography variant="body2">
                    {selectedContest.shift}
                  </Typography>
                </Grid>
              )}
              
              {selectedContest.hours_to_cover && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="primary">
                    Horas a cubrir
                  </Typography>
                  <Typography variant="body2">
                    {selectedContest.hours_to_cover} horas
                  </Typography>
                </Grid>
              )}
              
              {selectedContest.contract_type && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="primary">
                    Tipo de Contrato
                  </Typography>
                  <Typography variant="body2">
                    {selectedContest.contract_type}
                  </Typography>
                </Grid>
              )}
              
              {selectedContest.registration_deadline && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="primary">
                    Fecha de Cierre de Inscripción
                  </Typography>
                  <Typography variant="body2">
                    {format(new Date(selectedContest.registration_deadline), 'dd/MM/yyyy')}
                  </Typography>
                </Grid>
              )}
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary">
                  Enlace Original
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<OpenInNewIcon />}
                  onClick={() => window.open(selectedContest.source_url, '_blank')}
                  sx={{ mt: 1 }}
                >
                  Ver fuente original
                </Button>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetail}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContestList;
