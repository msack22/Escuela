import React, { useState, useEffect, useCallback } from 'react';

// Interfaces para TypeScript
interface Resolution {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
}

interface ResolutionMessage {
  id: number;
  content: string;
  author: string;
  message_type: 'user' | 'ai' | 'system';
  is_ai_response: boolean;
  created_at: string;
  ai_model?: string;
  ai_confidence?: string;
}

interface Document {
  id: number;
  title: string;
  file_type: string;
  created_at: string;
}

interface Tag {
  id: number;
  name: string;
  color: string;
  description?: string;
}

// Componente de mensaje del chat
const ChatMessage = ({ message }: { message: ResolutionMessage }) => {
  const isAI = message.is_ai_response;
  const isSystem = message.message_type === 'system';
  
  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className={`
        max-w-xs lg:max-w-md px-4 py-2 rounded-lg
        ${isAI ? 'bg-blue-100 text-blue-800' : 
          isSystem ? 'bg-gray-100 text-gray-600' : 
          'bg-green-100 text-green-800'}
      `}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">
            {message.author}
          </span>
          {isAI && (
            <span className="text-xs bg-blue-200 px-2 py-1 rounded">
              IA
            </span>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <div className="text-xs opacity-60 mt-1">
          {new Date(message.created_at).toLocaleString()}
          {message.ai_confidence && (
            <span className="ml-2">Confianza: {message.ai_confidence}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente principal de resoluciones y chat
const ResolutionsMenu = () => {
  const [resolutions, setResolutions] = React.useState<Resolution[]>([]);
  const [selectedResolution, setSelectedResolution] = React.useState<Resolution | null>(null);
  const [messages, setMessages] = React.useState<ResolutionMessage[]>([]);
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [tags, setTags] = React.useState<Tag[]>([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('');
  const [filterPriority, setFilterPriority] = React.useState('');
  
  // Formulario de nueva resolución
  const [newResolution, setNewResolution] = React.useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium' as const
  });

  // Cargar datos iniciales
  useEffect(() => {
    fetchResolutions();
    fetchTags();
  }, []);

  // Cargar mensajes cuando se selecciona una resolución
  useEffect(() => {
    if (selectedResolution) {
      fetchMessages(selectedResolution.id);
      fetchDocuments(selectedResolution.id);
    }
  }, [selectedResolution]);

  const fetchResolutions = async () => {
    try {
      const response = await fetch('http://localhost:8000/resolutions/');
      const data = await response.json();
      if (data.success) {
        setResolutions(data.data);
      }
    } catch (error) {
      console.error('Error cargando resoluciones:', error);
    }
  };

  const fetchMessages = async (resolutionId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/resolutions/${resolutionId}/messages`);
      const data = await response.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    }
  };

  const fetchDocuments = async (resolutionId?: number) => {
    try {
      const url = resolutionId 
        ? `http://localhost:8000/resolutions/documents?resolution_id=${resolutionId}`
        : 'http://localhost:8000/resolutions/documents';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.data);
      }
    } catch (error) {
      console.error('Error cargando documentos:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch('http://localhost:8000/resolutions/tags');
      const data = await response.json();
      if (data.success) {
        setTags(data.data);
      }
    } catch (error) {
      console.error('Error cargando etiquetas:', error);
    }
  };

  const createResolution = async () => {
    try {
      const response = await fetch('http://localhost:8000/resolutions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newResolution,
          created_by: 'Usuario Actual'
        })
      });

      const data = await response.json();
      if (data.success) {
        setResolutions(prev => [data.data, ...prev]);
        setShowCreateForm(false);
        setNewResolution({ title: '', description: '', category: '', priority: 'medium' });
        setSelectedResolution(data.data);
      }
    } catch (error) {
      console.error('Error creando resolución:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedResolution) return;

    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/resolutions/${selectedResolution.id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: newMessage,
          author: 'Usuario Actual'
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessages(prev => [...prev, data.user_message, data.ai_message]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'open': 'bg-yellow-100 text-yellow-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'resolved': 'bg-green-100 text-green-800',
      'closed': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-gray-100 text-gray-600',
      'medium': 'bg-orange-100 text-orange-800',
      'high': 'bg-red-100 text-red-800',
      'urgent': 'bg-purple-100 text-purple-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-600';
  };

  const filteredResolutions = resolutions.filter(resolution => {
    const matchesSearch = !searchQuery || 
      resolution.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resolution.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !filterStatus || resolution.status === filterStatus;
    const matchesPriority = !filterPriority || resolution.priority === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar con lista de resoluciones */}
      <div className="w-1/3 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Resoluciones</h2>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              + Nueva
            </button>
          </div>
          
          {/* Filtros */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Buscar resoluciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">Todos los estados</option>
                <option value="open">Abierta</option>
                <option value="in_progress">En progreso</option>
                <option value="resolved">Resuelta</option>
                <option value="closed">Cerrada</option>
              </select>
              
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">Todas las prioridades</option>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Lista de resoluciones */}
        <div className="divide-y divide-gray-200">
          {filteredResolutions.map(resolution => (
            <div
              key={resolution.id}
              onClick={() => setSelectedResolution(resolution)}
              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedResolution?.id === resolution.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-800 flex-1">{resolution.title}</h3>
                <div className="flex gap-1 ml-2">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(resolution.status)}`}>
                    {resolution.status}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(resolution.priority)}`}>
                    {resolution.priority}
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {resolution.description}
              </p>
              
              <div className="flex justify-between text-xs text-gray-500">
                <span>Creada: {new Date(resolution.created_at).toLocaleDateString()}</span>
                {resolution.category && <span>{resolution.category}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Área principal con chat y detalles */}
      <div className="flex-1 flex flex-col">
        {selectedResolution ? (
          <>
            {/* Header con detalles de la resolución */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    {selectedResolution.title}
                  </h2>
                  <div className="flex gap-2 mb-2">
                    <span className={`px-3 py-1 rounded ${getStatusColor(selectedResolution.status)}`}>
                      {selectedResolution.status}
                    </span>
                    <span className={`px-3 py-1 rounded ${getPriorityColor(selectedResolution.priority)}`}>
                      {selectedResolution.priority}
                    </span>
                    {selectedResolution.category && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded">
                        {selectedResolution.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <p className="text-gray-700 mb-3">
                {selectedResolution.description}
              </p>
              
              <div className="text-sm text-gray-500">
                Creada: {new Date(selectedResolution.created_at).toLocaleString()}
                {selectedResolution.updated_at && (
                  <span className="ml-4">
                    Actualizada: {new Date(selectedResolution.updated_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            
            {/* Área de chat */}
            <div className="flex-1 flex flex-col bg-gray-50">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-4xl mx-auto">
                  {messages.map(message => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                </div>
              </div>
              
              {/* Input de mensaje */}
              <div className="bg-white border-t border-gray-200 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Escribe tu mensaje o pregunta..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !newMessage.trim()}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Enviar'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Selecciona una resolución
              </h3>
              <p className="text-gray-500">
                O crea una nueva resolución para comenzar
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal para crear nueva resolución */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Nueva Resolución</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={newResolution.title}
                  onChange={(e) => setNewResolution(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Título de la resolución"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={newResolution.description}
                  onChange={(e) => setNewResolution(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Descripción detallada..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría
                </label>
                <input
                  type="text"
                  value={newResolution.category}
                  onChange={(e) => setNewResolution(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: administrativa, pedagógica, financiera"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridad
                </label>
                <select
                  value={newResolution.priority}
                  onChange={(e) => setNewResolution(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createResolution}
                disabled={!newResolution.title.trim() || !newResolution.description.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Crear Resolución
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResolutionsMenu;
