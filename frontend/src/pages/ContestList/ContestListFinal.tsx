import React, { useState, useEffect, useMemo } from 'react';
import { fetchContests, fetchCities, fetchDepartments } from '../../services/api';

// Componente de checkboxes para múltiples materias
const SubjectCheckboxGroup = ({ selectedSubjects, onChange, options }: {
  selectedSubjects: string[];
  onChange: (subjects: string[]) => void;
  options: Array<{ value: string; label: string; description?: string }>;
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const handleSubjectToggle = (subjectValue: string) => {
    const newSelection = selectedSubjects.includes(subjectValue)
      ? selectedSubjects.filter(s => s !== subjectValue)
      : [...selectedSubjects, subjectValue];
    onChange(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedSubjects.length === filteredOptions.length) {
      onChange([]);
    } else {
      onChange(filteredOptions.map(option => option.value));
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          📚 Materias ({selectedSubjects.length} seleccionadas)
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {isExpanded ? '▼ Ocultar' : '▶ Mostrar'} todas
        </button>
      </div>

      {/* Búsqueda de materias */}
      <div className="relative mb-3">
        <input
          type="text"
          placeholder="🔍 Buscar materias..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ❌
          </button>
        )}
      </div>

      {/* Botón de seleccionar todas */}
      <div className="flex items-center justify-between mb-3 p-2 bg-gray-50 rounded">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={selectedSubjects.length === filteredOptions.length && filteredOptions.length > 0}
            onChange={handleSelectAll}
            className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            {selectedSubjects.length === filteredOptions.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
          </span>
        </label>
        <span className="text-xs text-gray-500">
          {filteredOptions.length} materias disponibles
        </span>
      </div>

      {/* Lista de checkboxes */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ${isExpanded ? 'max-h-96 overflow-y-auto' : 'max-h-48 overflow-y-auto'}`}>
        {filteredOptions.map((option) => (
          <label
            key={option.value}
            className="flex items-start p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedSubjects.includes(option.value)}
              onChange={() => handleSubjectToggle(option.value)}
              className="mt-1 mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-800 text-sm">
                {option.label}
              </div>
              {option.description && (
                <div className="text-xs text-gray-500 mt-1">
                  {option.description}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>

      {/* Materias seleccionadas */}
      {selectedSubjects.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">
            ✅ Materias seleccionadas:
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedSubjects.map((subject) => (
              <span
                key={subject}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {subject}
                <button
                  onClick={() => handleSubjectToggle(subject)}
                  className="ml-1 hover:text-blue-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Interfaces
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

// Componente de búsqueda con autocompletado
const SearchInput = ({ value, onChange, placeholder, suggestions = [] }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions?: string[];
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = React.useState<string[]>([]);

  const filtered = useMemo(() => {
    if (!value) return suggestions;
    return suggestions.filter(suggestion =>
      suggestion.toLowerCase().includes(value.toLowerCase())
    );
  }, [value, suggestions]);

  React.useEffect(() => {
    setFilteredSuggestions(filtered);
  }, [filtered]);

  return (
    <div className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {value && (
          <button
            onClick={() => {
              onChange('');
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ❌
          </button>
        )}
      </div>
      
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => {
                onChange(suggestion);
                setIsOpen(false);
              }}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <span>{suggestion}</span>
                <span className="text-gray-400">🔍</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Dropdown con búsqueda y autocompletado
const SearchableDropdown = ({ value, onChange, options, placeholder }: {
  value: any;
  onChange: (value: any) => void;
  options: Array<{ value: any; label: string; description?: string }>;
  placeholder: string;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, options]);

  const selectedLabel = useMemo(() => {
    const option = options.find(opt => opt.value === value);
    return option ? option.label : '';
  }, [value, options]);

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
              suggestions={options.map(opt => opt.label)}
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

// Componente de tabla simple
const SimpleTable = ({ 
  data, 
  columns, 
  loading, 
  onRowClick,
  selectedRows,
  onSelectionChange 
}: {
  data: any[];
  columns: Array<{
    key: string;
    title: string;
    sortable?: boolean;
    width?: string;
    render?: (value: any, row: any) => React.ReactNode;
  }>;
  loading?: boolean;
  onRowClick?: (row: any) => void;
  selectedRows?: any[];
  onSelectionChange?: (rows: any[]) => void;
}) => {
  const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleRowSelection = (row: any) => {
    if (!onSelectionChange) return;
    
    const isSelected = selectedRows?.some((selectedRow: any) => selectedRow.id === row.id);
    const newSelection = isSelected
      ? selectedRows.filter((selectedRow: any) => selectedRow.id !== row.id)
      : [...(selectedRows || []), row];
    
    onSelectionChange(newSelection);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Cargando...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg mb-2">No se encontraron resultados</div>
        <div className="text-gray-400 text-sm">No hay datos disponibles</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {onSelectionChange && (
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedRows && data.length > 0 && selectedRows.length === data.length}
                  onChange={() => {
                    if (selectedRows && selectedRows.length === data.length) {
                      onSelectionChange([]);
                    } else {
                      onSelectionChange(data);
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
            )}
            {columns.map(column => (
              <th
                key={column.key}
                style={{ width: column.width }}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <div className="flex items-center gap-2">
                  <span>{column.title}</span>
                  {column.sortable && (
                    <button
                      onClick={() => handleSort(column.key)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <div className={`w-0 h-0 border-l-4 border-r-4 border-transparent ${
                        sortConfig?.key === column.key
                          ? sortConfig.direction === 'asc' 
                            ? 'border-b-4 border-gray-600'
                            : 'border-t-4 border-gray-600'
                          : 'border-b-4 border-gray-400'
                      }`}></div>
                    </button>
                  )}
                </div>
              </th>
            ))}
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedData.map((row, index) => (
            <tr
              key={row.id || index}
              onClick={() => onRowClick?.(row)}
              className="hover:bg-gray-50 cursor-pointer"
            >
              {onSelectionChange && (
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedRows?.some((selectedRow: any) => selectedRow.id === row.id)}
                    onChange={() => handleRowSelection(row)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
              )}
              {columns.map(column => (
                <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = row.source_url;
                      if (url && url.trim() !== '') {
                        window.open(url, '_blank');
                      } else {
                        // Mostrar información del concurso cuando no hay URL
                        const info = `📋 INFORMACIÓN DEL CONCURSO

🏆 TÍTULO:
${row.title || 'Sin título'}

🏫 ESCUELA:
${row.school_name || 'Sin escuela'}

📍 UBICACIÓN:
${row.school_city || 'Sin ciudad'}, ${row.school_department || 'Sin departamento'}

📚 MATERIA:
${row.subject_name || 'Sin materia'}

📅 FECHA:
${row.date || 'Sin fecha'}

⏰ LÍMITE INSCRIPCIÓN:
${row.registration_deadline || 'Sin fecha límite'}

🔗 FUENTE:
${row.source_url || 'No disponible'}

ℹ️ ESTADO:
${row.is_active ? '✅ Activo' : '❌ Inactivo'}

                        `.trim();
                        alert(info);
                      }
                    }}
                    className={`p-2 rounded-lg ${
                      row.source_url && row.source_url.trim() !== '' 
                        ? 'text-blue-600 hover:bg-blue-50' 
                        : 'text-orange-600 hover:bg-orange-50'
                    }`}
                    title={row.source_url && row.source_url.trim() !== '' ? "Ver detalles" : "Ver información del concurso"}
                  >
                    {row.source_url && row.source_url.trim() !== '' ? '🔗' : '📋'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Editar:', row);
                    }}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-50"
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`¿Estás seguro de que quieres eliminar "${row.title}"?`)) {
                        console.log('Eliminar:', row);
                      }
                    }}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Componente principal
const ContestListImproved: React.FC = () => {
  const [contests, setContests] = React.useState<Contest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedContests, setSelectedContests] = React.useState<Contest[]>([]);
  
  // Estados para filtros
  const [cities, setCities] = React.useState<Array<{ value: string; label: string }>>([]);
  const [departments, setDepartments] = React.useState<Array<{ value: string; label: string }>>([]);
  const [selectedCity, setSelectedCity] = React.useState('');
  const [selectedDepartment, setSelectedDepartment] = React.useState('');
  const [selectedSubject, setSelectedSubject] = React.useState('');
  const [selectedSubjects, setSelectedSubjects] = React.useState<string[]>([]); // Nueva: múltiples materias
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  // Cargar datos iniciales
  React.useEffect(() => {
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

  // Opciones de materias
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

  // Definición de columnas
  const columns = [
    {
      key: 'title',
      title: 'Título',
      sortable: true,
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
      width: '200px'
    },
    {
      key: 'school_city',
      title: 'Ciudad',
      sortable: true,
      width: '150px'
    },
    {
      key: 'school_department',
      title: 'Departamento',
      sortable: true,
      width: '150px'
    },
    {
      key: 'date',
      title: 'Fecha',
      sortable: true,
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

  // Filtrar concursos
  const filteredContests = contests.filter(contest => {
    if (selectedCity && contest.school_city !== selectedCity) return false;
    if (selectedDepartment && contest.school_department !== selectedDepartment) return false;
    if (selectedSubjects.length > 0 && !selectedSubjects.includes(contest.subject_name)) return false;
    return true;
  });

  // Calcular paginación
  const paginatedContests = filteredContests.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredContests.length / pageSize);

  return (
    <div className="space-y-6">
      {/* Filtros superiores */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Filtros de Búsqueda Mejorados</h2>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ciudad
            </label>
            <SearchableDropdown
              value={selectedCity}
              onChange={setSelectedCity}
              options={cities}
              placeholder="Seleccionar ciudad"
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
            />
          </div>
          
          <div className="lg:col-span-2">
            <SubjectCheckboxGroup
              selectedSubjects={selectedSubjects}
              onChange={setSelectedSubjects}
              options={subjectOptions}
            />
          </div>
        </div>
        
        {/* Botones de acción */}
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-600">
            {selectedSubjects.length > 0 && (
              <span>📚 {selectedSubjects.length} materia(s) seleccionada(s)</span>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedCity('');
              setSelectedDepartment('');
              setSelectedSubjects([]);
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            🧹 Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Tabla de concursos */}
      <div className="bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold p-6 pb-0">
          Lista de Concursos ({filteredContests.length} encontrados)
        </h2>
        
        <SimpleTable
          data={paginatedContests}
          columns={columns}
          loading={loading}
          selectedRows={selectedContests}
          onSelectionChange={setSelectedContests}
          onRowClick={(row) => {
            console.log('Row clicked:', row);
          }}
        />
        
        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Mostrando</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>por página</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                
                <span className="text-sm text-gray-700">
                  Página {currentPage} de {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContestListImproved;
