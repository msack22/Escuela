import React, { useState, useEffect, useMemo } from 'react';

// Interfaces para TypeScript
interface TableColumn {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface TableAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: (row: any) => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface DataTableProps {
  data: any[];
  columns: TableColumn[];
  loading?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  actions?: TableAction[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    pageSize: number;
    onPageSizeChange: (size: number) => void;
  };
  onRowClick?: (row: any) => void;
  selectedRows?: any[];
  onSelectionChange?: (rows: any[]) => void;
}

// Componente de búsqueda con autocompletado (sin dependencias externas)
const SearchInput = ({ 
  value, 
  onChange, 
  placeholder, 
  suggestions = [],
  onSuggestionSelect 
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);

  const filtered = useMemo(() => {
    if (!value) return suggestions;
    return suggestions.filter(suggestion =>
      suggestion.toLowerCase().includes(value.toLowerCase())
    );
  }, [value, suggestions]);

  useEffect(() => {
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
              onSuggestionSelect?.('');
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ❌
          </button>
        )}
      </div>
      
      {/* Dropdown de autocompletado */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => {
                onChange(suggestion);
                onSuggestionSelect?.(suggestion);
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

// Dropdown con búsqueda y autocompletado (sin dependencias externas)
const SearchableDropdown = ({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  searchable = true,
  multiSelect = false,
  selectedItems = []
}: {
  value: any;
  onChange: (value: any) => void;
  options: Array<{ value: any; label: string; description?: string }>;
  placeholder: string;
  searchable?: boolean;
  multiSelect?: boolean;
  selectedItems?: any[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, options, searchable]);

  const selectedLabels = useMemo(() => {
    if (multiSelect) {
      return selectedItems.map(item => 
        options.find(opt => opt.value === item)?.label || ''
      ).filter(Boolean);
    }
    const option = options.find(opt => opt.value === value);
    return option ? option.label : '';
  }, [value, selectedItems, options, multiSelect]);

  const handleSelect = (option: any) => {
    if (multiSelect) {
      const newSelection = selectedItems.includes(option.value)
        ? selectedItems.filter(item => item !== option.value)
        : [...selectedItems, option.value];
      onChange(newSelection);
    } else {
      onChange(option.value);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <span className={selectedLabels.length === 0 ? 'text-gray-500' : ''}>
          {multiSelect 
            ? selectedLabels.length > 0 ? `${selectedLabels.length} seleccionados` : placeholder
            : selectedLabels || placeholder
          }
        </span>
        <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {searchable && (
            <div className="p-3 border-b border-gray-200">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={`Buscar ${placeholder.toLowerCase()}...`}
                suggestions={options.map(opt => opt.label)}
              />
            </div>
          )}
          
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.map((option, index) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option)}
                className={`px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 flex items-center justify-between ${
                  multiSelect && selectedItems.includes(option.value) ? 'bg-blue-50' : ''
                }`}
              >
                <div>
                  <div className="font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-sm text-gray-500">{option.description}</div>
                  )}
                </div>
                {multiSelect && (
                  <div className={`w-4 h-4 border-2 rounded ${
                    selectedItems.includes(option.value)
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {selectedItems.includes(option.value) && (
                      <div className="text-white text-xs">✓</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Componente principal de tabla de datos
const DataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  loading = false,
  searchable = true,
  filterable = true,
  actions = [],
  pagination,
  onRowClick,
  selectedRows = [],
  onSelectionChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Filtrar y ordenar datos
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...data];

    // Aplicar búsqueda
    if (searchTerm) {
      filtered = filtered.filter(row =>
        columns.some(column => {
          const value = row[column.key];
          return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Aplicar filtros
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter(row =>
          row[key] && row[key].toString().toLowerCase().includes(value.toLowerCase())
        );
      }
    });

    // Aplicar ordenamiento
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, filters, sortConfig, columns]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleRowSelection = (row: any) => {
    if (!onSelectionChange) return;
    
    const isSelected = selectedRows.some(selectedRow => selectedRow.id === row.id);
    const newSelection = isSelected
      ? selectedRows.filter(selectedRow => selectedRow.id !== row.id)
      : [...selectedRows, row];
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    
    const allSelected = selectedRows.length === filteredAndSortedData.length;
    const newSelection = allSelected ? [] : filteredAndSortedData;
    onSelectionChange(newSelection);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header con búsqueda y filtros */}
      {(searchable || filterable) && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4">
            {searchable && (
              <div className="flex-1">
                <SearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Buscar en todos los campos..."
                />
              </div>
            )}
            
            {filterable && (
              <div className="flex gap-2 flex-wrap">
                {columns.filter(col => col.filterable).map(column => (
                  <input
                    key={column.key}
                    type="text"
                    placeholder={`Filtrar ${column.title}...`}
                    value={filters[column.key] || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      [column.key]: e.target.value
                    }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controles de tabla */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {onSelectionChange && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedRows.length === filteredAndSortedData.length && filteredAndSortedData.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  {selectedRows.length > 0 
                    ? `${selectedRows.length} seleccionados`
                    : 'Seleccionar todos'
                  }
                </span>
              </label>
            )}
            
            <span className="text-sm text-gray-500">
              {filteredAndSortedData.length} resultados
            </span>
          </div>

          <div className="flex items-center gap-2">
            {actions.map(action => (
              <button
                key={action.key}
                onClick={() => {
                  if (selectedRows.length > 0) {
                    selectedRows.forEach(row => action.onClick(row));
                  }
                }}
                disabled={selectedRows.length === 0}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  action.variant === 'primary' ? 'bg-blue-500 text-white hover:bg-blue-600' :
                  action.variant === 'danger' ? 'bg-red-500 text-white hover:bg-red-600' :
                  'bg-gray-500 text-white hover:bg-gray-600'
                }`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Cargando...</span>
          </div>
        ) : filteredAndSortedData.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-2">No se encontraron resultados</div>
            <div className="text-gray-400 text-sm">
              {searchTerm || Object.values(filters).some(v => v) 
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'No hay datos disponibles'
              }
            </div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {onSelectionChange && (
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.length === filteredAndSortedData.length && filteredAndSortedData.length > 0}
                      onChange={handleSelectAll}
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
                {actions.length > 0 && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedData.map((row, index) => (
                <tr
                  key={row.id || index}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-gray-50 cursor-pointer ${
                    selectedRows.some(selectedRow => selectedRow.id === row.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  {onSelectionChange && (
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedRows.some(selectedRow => selectedRow.id === row.id)}
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
                  {actions.length > 0 && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        {actions.map(action => (
                          <button
                            key={action.key}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick(row);
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              action.variant === 'primary' ? 'text-blue-600 hover:bg-blue-50' :
                              action.variant === 'danger' ? 'text-red-600 hover:bg-red-50' :
                              'text-gray-600 hover:bg-gray-50'
                            }`}
                            title={action.label}
                          >
                            {action.icon}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {pagination && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>Mostrando</span>
              <select
                value={pagination.pageSize}
                onChange={(e) => pagination.onPageSizeChange(Number(e.target.value))}
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
                onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              
              <span className="text-sm text-gray-700">
                Página {pagination.currentPage} de {pagination.totalPages}
              </span>
              
              <button
                onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { DataTable, SearchInput, SearchableDropdown };
