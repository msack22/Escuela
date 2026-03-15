import axios from 'axios';
// import { simpleLogger } from '../utils/simpleLogger.js';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Contest API calls
export const fetchContests = async (params: any = {}) => {
  // Clean empty parameters and format dates
  const cleanParams = Object.keys(params).reduce((acc: any, key) => {
    if (params[key] !== '' && params[key] !== null && params[key] !== undefined) {
      // Convert date strings to datetime format for API
      if (key === 'date_from' || key === 'date_to') {
        acc[key] = new Date(params[key]).toISOString();
      } else {
        acc[key] = params[key];
      }
    }
    return acc;
  }, {});
  
  const response = await api.get('/api/contests/', { params: cleanParams });
  return response.data;
};

export const fetchContestById = async (id: number) => {
  const response = await api.get(`/api/contests/${id}`);
  return response.data;
};

export const fetchContestStatistics = async () => {
  const response = await api.get('/api/contests/statistics/summary');
  return response.data;
};

export const fetchSubjects = async () => {
  const response = await api.get('/api/subjects/');
  return response.data;
};

export const fetchCities = async () => {
  const response = await api.get('/api/contests/filters/cities');
  return response.data;
};

export const fetchDepartments = async () => {
  const response = await api.get('/api/contests/filters/departments');
  return response.data;
};

// New filter functions
export const fetchLevels = async () => {
  const response = await api.get('/api/contests/filters/levels');
  return response.data;
};

export const fetchShifts = async () => {
  const response = await api.get('/api/contests/filters/shifts');
  return response.data;
};

export const fetchContractTypes = async () => {
  const response = await api.get('/api/contests/filters/contract-types');
  return response.data;
};

// Interceptor para manejar errores con logging básico
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Loggear error automáticamente en consola
    if (error.response) {
      // Error de respuesta del servidor (4xx, 5xx)
      console.error('API Response Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    } else if (error.request) {
      // Error de red
      console.error('Network Error:', {
        url: error.config?.url,
        method: error.config?.method,
        message: error.message
      });
    } else {
      // Error en la configuración
      console.error('API Configuration Error:', {
        message: error.message,
        config: error.config
      });
    }
    
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Alert API calls
export const fetchAlerts = async () => {
  const response = await api.get('/api/alerts/');
  return response.data;
};

export const createAlert = async (alertData: any) => {
  const response = await api.post('/api/alerts/', alertData);
  return response.data;
};

export const updateAlert = async (id: number, alertData: any) => {
  const response = await api.put(`/api/alerts/${id}`, alertData);
  return response.data;
};

export const deactivateAlert = async (id: number) => {
  const response = await api.delete(`/api/alerts/${id}`);
  return response.data;
};

export const deleteAlert = async (id: number) => {
  const response = await api.delete(`/api/alerts/${id}`);
  return response.data;
};

// Notification API calls
export const sendTestNotification = async (notificationData: any) => {
  const response = await api.post('/api/alerts/test-notification', notificationData);
  return response.data;
};

export const getAvailableNotificationChannels = async () => {
  const response = await api.get('/api/alerts/notification-channels');
  return response.data;
};

export const sendMultiNotification = async (notificationData: any) => {
  const response = await api.post('/api/alerts/send-multi', notificationData);
  return response.data;
};

// Statistics API calls
export const fetchSystemStatus = async () => {
  const response = await api.get('/api/status');
  return response.data;
};

export const fetchScrapingStatus = async () => {
  const response = await api.get('/api/scraping/status');
  return response.data;
};

export const triggerManualScraping = async (source?: string) => {
  const response = await api.post('/api/scraping/trigger', { source });
  return response.data;
};

export const runManualScraping = async (sourceName?: string) => {
  const params = sourceName ? { source_name: sourceName } : {};
  const response = await api.post('/api/scraping/run', null, { 
    params,
    timeout: 120000 // 2 minutes timeout for scraping operations
  });
  return response.data;
};

export const startScheduler = async () => {
  const response = await api.post('/api/scraping/start');
  return response.data;
};

export const stopScheduler = async () => {
  const response = await api.post('/api/scraping/stop');
  return response.data;
};

export const fetchScrapingLogs = async (limit: number = 50) => {
  const response = await api.get(`/api/scraping/logs?limit=${limit}`);
  return response.data;
};

// Capacitaciones API calls
export const fetchCapacitaciones = async (params: any = {}) => {
  const response = await api.get('/api/capacitaciones/capacitaciones', { params });
  return response.data;
};

export const fetchCapacitacionById = async (id: number) => {
  const response = await api.get(`/api/capacitaciones/capacitaciones/${id}`);
  return response.data;
};

export const createCapacitacion = async (capacitacion: any) => {
  const response = await api.post('/api/capacitaciones/capacitaciones', capacitacion);
  return response.data;
};

export const scrapeCapacitaciones = async () => {
  const response = await api.post('/api/capacitaciones/capacitaciones/scrape');
  return response.data;
};

export const fetchCapacitacionesStatistics = async () => {
  const response = await api.get('/api/capacitaciones/capacitaciones/statistics');
  return response.data;
};

// Resoluciones API calls
export const fetchResoluciones = async (params: any = {}) => {
  const response = await api.get('/api/capacitaciones/resoluciones', { params });
  return response.data;
};

export const fetchResolucionById = async (id: number) => {
  const response = await api.get(`/api/capacitaciones/resoluciones/${id}`);
  return response.data;
};

// Chat de Resoluciones API calls
export const consultarResolucion = async (pregunta: string, sessionId: string) => {
  const response = await api.post('/api/capacitaciones/resoluciones/consultar', {
    pregunta,
    session_id: sessionId,
  });
  return response.data;
};

export const calificarConsulta = async (consultaId: number, calificacion: number, feedback?: string) => {
  const response = await api.post('/api/capacitaciones/resoluciones/calificar', {
    consulta_id: consultaId,
    calificacion,
    feedback,
  });
  return response.data;
};

export const fetchConsultasStatistics = async () => {
  const response = await api.get('/api/capacitaciones/resoluciones/estadisticas');
  return response.data;
};

// School API calls
export const fetchSchools = async (params: any = {}) => {
  const response = await api.get('/api/schools/', { params });
  return response.data;
};

export const fetchSchoolById = async (id: number) => {
  const response = await api.get(`/api/schools/${id}`);
  return response.data;
};

export const geocodeSchool = async (id: number) => {
  const response = await api.post(`/api/schools/${id}/geocode`);
  return response.data;
};

export const geocodeAllSchools = async () => {
  const response = await api.post('/api/schools/geocode-all');
  return response.data;
};

export default api;
