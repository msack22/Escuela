import axios from 'axios';
import { logger, useApiLogger } from '../utils/logger_simple';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Contest API calls
export const fetchContests = async (params: any = {}) => {
  const response = await api.get('/api/contests/', { params });
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

// Interceptor para logging de peticiones
api.interceptors.request.use(
  (config) => {
    logger.info('API_REQUEST', `Starting ${config.method?.toUpperCase()} ${config.url}`, {
      method: config.method,
      url: config.url,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    logger.error('API_REQUEST_ERROR', 'Request failed', { error: error.message });
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    logger.info('API_RESPONSE', `Response received: ${response.status}`, {
      status: response.status,
      url: response.config.url,
      method: response.config.method,
      duration: response.config.metadata?.duration,
    });
    return response;
  },
  (error) => {
    logger.error('API_RESPONSE_ERROR', 'Response failed', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      error: error.message,
    });
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

export const deleteAlert = async (id: number) => {
  const response = await api.delete(`/api/alerts/${id}`);
  return response.data;
};

export const sendTestNotification = async (whatsappNumber: string) => {
  const response = await api.post('/api/alerts/test-notification', {
    whatsapp_number: whatsappNumber,
  });
  return response.data;
};

// Scraping API calls
export const fetchSystemStatus = async () => {
  const response = await api.get('/api/status');
  return response.data;
};

export const fetchScrapingStatus = async () => {
  const response = await api.get('/api/scraping/status');
  return response.data;
};

export const fetchScrapingLogs = async (limit: number = 50) => {
  const response = await api.get('/api/scraping/logs', { params: { limit } });
  return response.data;
};

export const runManualScraping = async (sourceName?: string) => {
  const params = sourceName ? { source_name: sourceName } : {};
  const response = await api.post('/api/scraping/run', null, { params });
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
