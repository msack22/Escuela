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
} from '@mui/icons-material';
import { useQuery } from 'react-query';
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
} from '../../services/api.ts';

const ContestList: React.FC = () => {
  const [filters, setFilters] = useState({
    title_contains: '',
    subject_id: '',
    city: '',
    department: '',
    date_from: '',
    date_to: '',
    is_active: true,
  });

  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 20,
  });

  const {
    data: contestsData,
    isLoading,
    error,
    refetch,
  } = useQuery(
    ['contests', filters, pagination],
    () => fetchContests({ ...filters, ...pagination }),
    {
      keepPreviousData: true,
    }
  );

  const { data: subjects } = useQuery('subjects', fetchSubjects);
  const { data: citiesData } = useQuery('cities', fetchCities);
  const { data: departmentsData } = useQuery('departments', fetchDepartments);

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
      subject_id: '',
      city: '',
      department: '',
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
                <InputLabel>Materia</InputLabel>
                <Select
                  value={filters.subject_id}
                  label="Materia"
                  onChange={(e) => handleFilterChange('subject_id', e.target.value)}
                >
                  <MenuItem value="">Todas</MenuItem>
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
                <InputLabel>Ciudad</InputLabel>
                <Select
                  value={filters.city}
                  label="Ciudad"
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                >
                  <MenuItem value="">Todas</MenuItem>
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
                <InputLabel>Departamento</InputLabel>
                <Select
                  value={filters.department}
                  label="Departamento"
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
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
                    <TableCell>Fecha</TableCell>
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
                        <Chip
                          label={contest.is_active ? 'Activo' : 'Inactivo'}
                          size="small"
                          color={contest.is_active ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Ver fuente original">
                          <IconButton
                            size="small"
                            onClick={() => window.open(contest.source.url, '_blank')}
                          >
                            <OpenInNewIcon />
                          </IconButton>
                        </Tooltip>
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
    </Box>
  );
};

export default ContestList;
