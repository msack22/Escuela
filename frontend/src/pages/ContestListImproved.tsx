import React, { useState, useEffect } from 'react';
import { fetchContests, fetchCities, fetchDepartments } from '../services/api';

// Componentes simples sin dependencias externas
const SearchInput = ({ value, onChange, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => (
  <div className="relative">
    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        ❌
      </button>
    )}
  </div>
);

const SearchableDropdown = ({ value, onChange, options, placeholder }: {
  value: any;
  onChange: (value: any) => void;
  options: Array<{ value: any; label: string; description?: string }>;
  placeholder: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedLabel = options.find(opt => opt.value === value)?.label || '';

  const handleSelect = (option: any) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <span className={selectedLabel ? '' : 'text-gray-500'}>
          {selectedLabel || placeholder}
        </span>
        <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="p-3 border-b border-gray-200">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={`Buscar ${placeholder.toLowerCase()}...`}
            />
          </div>
          
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.map((option, index) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option)}
                className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <div className="font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-sm text-gray-500">{option.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface Contest {
  id: number;
  title: string;
  description: string;
  date: string;
  registration_deadline: string;
  school_name: string;
  school_city: string;
  school_department: string;
  subject_name: string;
  source_url: string;
  is_active: boolean;
}

const ContestList: React.FC = () => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContests, setSelectedContests] = useState<Contest[]>([]);
  
  // Estados para filtros
  const [cities, setCities] = useState<Array<{ value: string; label: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ value: string; label: string }>>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
    loadFilters();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchContests();
      setContests(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading contests:', error);
      setLoading(false);
    }
  };

  const loadFilters = async () => {
    try {
      const [citiesData, departmentsData] = await Promise.all([
        fetchCities(),
        fetchDepartments()
      ]);
      
      // Convertir a formato para el dropdown
      const citiesOptions = citiesData.map(city => ({
        value: city,
        label: city
      }));
      
      const departmentsOptions = departmentsData.map(dept => ({
        value: dept,
        label: dept
      }));
      
      setCities(citiesOptions);
      setDepartments(departmentsOptions);
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  };

  // Opciones de materias (usando las que creamos)
  const subjectOptions = [
    { value: 'Matemática', label: 'Matemática', description: 'Área de matemáticas y ciencias exactas' },
    { value: 'Lengua y Literatura', label: 'Lengua y Literatura', description: 'Área de lengua española y literatura' },
    { value: 'Historia', label: 'Historia', description: 'Área de historia y ciencias sociales' },
    { value: 'Geografía', label: 'Geografía', description: 'Área de geografía y espacio geográfico' },
    { value: 'Ciencias Naturales', label: 'Ciencias Naturales', description: 'Área de ciencias naturales y biología' },
    { value: 'Biología', label: 'Biología', description: 'Área específica de biología' },
    { value: 'Física', label: 'Física', description: 'Área de física y ciencias físicas' },
    { value: 'Química', label: 'Química', description: 'Área de química' },
    { value: 'Educación Física', label: 'Educación Física', description: 'Área de educación física y deportes' },
    { value: 'Inglés', label: 'Inglés', description: 'Área de idioma inglés' },
    { value: 'Francés', label: 'Francés', description: 'Área de idioma francés' },
    { value: 'Italiano', label: 'Italiano', description: 'Área de idioma italiano' },
    { value: 'Portugués', label: 'Portugués', description: 'Área de idioma portugués' },
    { value: 'Música', label: 'Música', description: 'Área de educación musical' },
    { value: 'Artes Plásticas', label: 'Artes Plásticas', description: 'Área de artes plásticas y visuales' },
    { value: 'Informática', label: 'Informática', description: 'Área de computación y tecnología' },
    { value: 'Filosofía', label: 'Filosofía', description: 'Área de filosofía y ética' },
    { value: 'Psicología', label: 'Psicología', description: 'Área de psicología educativa' },
    { value: 'Sociología', label: 'Sociología', description: 'Área de sociología' },
    { value: 'Economía', label: 'Economía', description: 'Área de economía y administración' },
    { value: 'Contabilidad', label: 'Contabilidad', description: 'Área de contabilidad' },
    { value: 'Administración', label: 'Administración', description: 'Área de administración y gestión' },
    { value: 'Derecho', label: 'Derecho', description: 'Área de derecho y legislación' },
    { value: 'Trabajo Práctico', label: 'Trabajo Práctico', description: 'Área de trabajo práctico y pasantías' },
    { value: 'Orientación Educativa', label: 'Orientación Educativa', description: 'Área de orientación educativa y vocacional' },
    { value: 'Educación Primaria', label: 'Educación Primaria', description: 'Nivel educativo primario' },
    { value: 'Educación Secundaria', label: 'Educación Secundaria', description: 'Nivel educativo secundario' },
    { value: 'Educación Inicial', label: 'Educación Inicial', description: 'Nivel educativo inicial/jardín' },
    { value: 'Educación Especial', label: 'Educación Especial', description: 'Área de educación especial' },
    { value: 'Formación Docente', label: 'Formación Docente', description: 'Área de formación y capacitación docente' },
    { value: 'Supervisor Educativo', label: 'Supervisor Educativo', description: 'Cargo de supervisor educativo' },
    { value: 'Director de Escuela', label: 'Director de Escuela', description: 'Cargo de dirección escolar' },
    { value: 'Secretario Escolar', label: 'Secretario Escolar', description: 'Cargo de secretaría escolar' },
    { value: 'Preceptor', label: 'Preceptor', description: 'Cargo de preceptoría' },
    { value: 'Profesor de Apoyo', label: 'Profesor de Apoyo', description: 'Cargo de profesor de apoyo' },
    { value: 'Bibliotecario', label: 'Bibliotecario', description: 'Cargo de bibliotecario escolar' },
    { value: 'Todos los Niveles', label: 'Todos los Niveles', description: 'Aplicable a todos los niveles educativos' }
  ];

  // Definición de columnas para la tabla
  const columns = [
    {
      key: 'title',
      title: 'Título',
      sortable: true,
      filterable: true,
      width: '300px',
      render: (value: string, row: Contest) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{row.school_name}</div>
        </div>
      )
    },
    {
      key: 'subject_name',
      title: 'Materia',
      sortable: true,
      filterable: true,
      width: '200px'
    },
    {
      key: 'school_city',
      title: 'Ciudad',
      sortable: true,
      filterable: true,
      width: '150px'
    },
    {
      key: 'school_department',
      title: 'Departamento',
      sortable: true,
      filterable: true,
      width: '150px'
    },
    {
      key: 'date',
      title: 'Fecha',
      sortable: true,
      filterable: true,
      width: '120px',
      render: (value: string) => (
        <div className="text-sm">
          {new Date(value).toLocaleDateString()}
        </div>
      )
    },
    {
      key: 'registration_deadline',
      title: 'Fecha Límite',
      sortable: true,
      filterable: true,
      width: '120px',
      render: (value: string) => (
        <div className="text-sm">
          {value ? new Date(value).toLocaleDateString() : 'N/A'}
        </div>
      )
    },
    {
      key: 'is_active',
      title: 'Estado',
      sortable: true,
      filterable: true,
      width: '100px',
      render: (value: boolean) => (
        <span className={`px-2 py-1 text-xs rounded-full ${
          value 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {value ? 'Activo' : 'Inactivo'}
        </span>
      )
    }
  ];

  // Acciones para la tabla
  const actions = [
    {
      key: 'view',
      label: 'Ver',
      icon: <span>👁️</span>,
      variant: 'primary' as const,
      onClick: (row: Contest) => {
        window.open(row.source_url, '_blank');
      }
    },
    {
      key: 'edit',
      label: 'Editar',
      icon: <span>✏️</span>,
      variant: 'secondary' as const,
      onClick: (row: Contest) => {
        console.log('Editar concurso:', row);
        // Aquí irías a la página de edición
      }
    },
    {
      key: 'delete',
      label: 'Eliminar',
      icon: <span>🗑️</span>,
      variant: 'danger' as const,
      onClick: (row: Contest) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar "${row.title}"?`)) {
          console.log('Eliminar concurso:', row);
          // Aquí llamarías a la API para eliminar
        }
      }
    }
  ];

  // Filtrar concursos basados en los filtros seleccionados
  const filteredContests = contests.filter(contest => {
    if (selectedCity && contest.school_city !== selectedCity) return false;
    if (selectedDepartment && contest.school_department !== selectedDepartment) return false;
    if (selectedSubject && contest.subject_name !== selectedSubject) return false;
    return true;
  });

  // Calcular paginación
  const paginatedContests = filteredContests.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const calculatedTotalPages = Math.ceil(filteredContests.length / pageSize);

  useEffect(() => {
    setTotalPages(calculatedTotalPages);
  }, [calculatedTotalPages]);

  return (
    <div className="space-y-6">
      {/* Filtros superiores */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Filtros de Búsqueda</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ciudad
            </label>
            <SearchableDropdown
              value={selectedCity}
              onChange={setSelectedCity}
              options={cities}
              placeholder="Seleccionar ciudad"
              searchable={true}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Departamento
            </label>
            <SearchableDropdown
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              options={departments}
              placeholder="Seleccionar departamento"
              searchable={true}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Materia
            </label>
            <SearchableDropdown
              value={selectedSubject}
              onChange={setSelectedSubject}
              options={subjectOptions}
              placeholder="Seleccionar materia"
              searchable={true}
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedCity('');
                setSelectedDepartment('');
                setSelectedSubject('');
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de concursos */}
      <div className="bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold p-6 pb-0">
          Lista de Concursos ({filteredContests.length} encontrados)
        </h2>
        
        <DataTable
          data={paginatedContests}
          columns={columns}
          loading={loading}
          searchable={true}
          filterable={true}
          actions={actions}
          selectedRows={selectedContests}
          onSelectionChange={setSelectedContests}
          pagination={{
            currentPage,
            totalPages: calculatedTotalPages,
            onPageChange: setCurrentPage,
            pageSize,
            onPageSizeChange: setPageSize
          }}
          onRowClick={(row) => {
            console.log('Row clicked:', row);
            // Aquí podrías abrir un modal con detalles
          }}
        />
      </div>
    </div>
  );
};

export default ContestList;
