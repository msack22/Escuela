import axios from 'axios';
// import { simpleLogger } from '../utils/simpleLogger.js';

// En Vite las variables de entorno se acceden con import.meta.env
// Por defecto apuntamos al backend FastAPI en el puerto 8000
export const API_BASE_URL = import.meta.env.VITE_API_URL ||
  `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8000`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Contest API calls – default when backend unavailable
const DEFAULT_CONTESTS_RESPONSE = { contests: [], total: 0, skip: 0, limit: 100 };

/** Serializa params para FastAPI: listas como claves repetidas (subject_ids=1&subject_ids=2) */
function serializeContestParams(cleanParams: Record<string, any>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(cleanParams)) {
    if (Array.isArray(v)) {
      v.forEach((item: any) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`));
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join('&');
}

export const fetchContests = async (params: any = {}) => {
  try {
    const cleanParams: Record<string, any> = {};
    for (const key of Object.keys(params)) {
      const val = params[key];
      if (val === '' || val === null || val === undefined) continue;
      if (Array.isArray(val) && val.length === 0) continue;
      if (key === 'date_from' || key === 'date_to') {
        cleanParams[key] = new Date(val).toISOString();
      } else {
        cleanParams[key] = val;
      }
    }
    const query = Object.keys(cleanParams).length ? `?${serializeContestParams(cleanParams)}` : '';
    const response = await api.get(`/api/contests/${query}`);
    return response.data;
  } catch {
    return DEFAULT_CONTESTS_RESPONSE;
  }
};

export const fetchContestById = async (id: number) => {
  const response = await api.get(`/api/contests/${id}`);
  return response.data;
};

export const deleteContest = async (id: number) => {
  await api.delete(`/api/contests/${id}`);
  return true;
};

const DEFAULT_STATISTICS = {
  total_contests: 0,
  active_contests: 0,
  total_schools: 0,
  total_subjects: 0,
  contests_by_month: [] as unknown[],
};

export const fetchContestStatistics = async () => {
  try {
    const response = await api.get('/api/contests/statistics/summary');
    return { ...DEFAULT_STATISTICS, ...response.data };
  } catch {
    return DEFAULT_STATISTICS;
  }
};

export const fetchSubjects = async () => {
  try {
    const response = await api.get('/api/subjects/');
    return response.data ?? [];
  } catch {
    return [];
  }
};

export const fetchCities = async () => {
  try {
    const response = await api.get('/api/contests/filters/cities');
    const data = response.data;
    return Array.isArray(data) ? data : (data?.cities ?? []);
  } catch {
    return [];
  }
};

export const fetchDepartments = async () => {
  try {
    const response = await api.get('/api/contests/filters/departments');
    const data = response.data;
    return Array.isArray(data) ? data : (data?.departments ?? []);
  } catch {
    return [];
  }
};

export const fetchLevels = async () => {
  try {
    const response = await api.get('/api/contests/filters/levels');
    const data = response.data;
    return Array.isArray(data) ? data : (data?.levels ?? []);
  } catch {
    return [];
  }
};

export const fetchShifts = async () => {
  try {
    const response = await api.get('/api/contests/filters/shifts');
    const data = response.data;
    return Array.isArray(data) ? data : (data?.shifts ?? []);
  } catch {
    return [];
  }
};

export const fetchContractTypes = async () => {
  try {
    const response = await api.get('/api/contests/filters/contract-types');
    const data = response.data;
    return Array.isArray(data) ? data : (data?.contract_types ?? []);
  } catch {
    return [];
  }
};

export const fetchSources = async (): Promise<{ name: string }[]> => {
  try {
    const response = await api.get<{ sources?: { name: string }[] }>('/api/contests/filters/sources');
    const data = response.data;
    const list = Array.isArray(data?.sources) ? data.sources : [];
    return list;
  } catch (err) {
    console.warn('[API] fetchSources failed:', err);
    return [];
  }
};

// Log de todas las peticiones salientes
api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const url = config.baseURL && config.url ? `${config.baseURL}${config.url}` : config.url;
  console.info(`[API] → ${method} ${url}`);
  return config;
});

// Evitar spamear consola cuando el backend no está (solo avisar una vez cada 10 s)
let lastNetworkErrorLog = 0;
const NETWORK_ERROR_LOG_INTERVAL_MS = 10000;

// Log de respuestas (éxito y error)
api.interceptors.response.use(
  (response) => {
    const method = (response.config?.method ?? 'get').toUpperCase();
    const url = response.config?.url ?? '';
    const status = response.status;
    console.info(`[API] ← ${method} ${url} → ${status}`);
    return response;
  },
  (error) => {
    const method = (error.config?.method ?? 'get').toUpperCase();
    const url = error.config?.url ?? '';
    if (error.response) {
      console.error(`[API] ← ${method} ${url} → ${error.response?.status}`, error.response?.data);
    } else if (error.request) {
      const now = Date.now();
      if (now - lastNetworkErrorLog >= NETWORK_ERROR_LOG_INTERVAL_MS) {
        lastNetworkErrorLog = now;
        console.warn(
          '[API] Backend no disponible (conexión rechazada). Ejecute en una terminal: cd backend && python run.py'
        );
      }
    } else {
      console.error('[API] Error:', error.message, error.config);
    }
    return Promise.reject(error);
  }
);

// Alert API calls
export const fetchAlerts = async () => {
  try {
    const response = await api.get('/api/alerts/');
    const raw = response.data;
    const list: any[] = Array.isArray(raw) ? raw : raw?.results ?? raw ?? [];

    // Normalizamos subject_preferences (string JSON) -> arrays para el frontend
    return list.map((alert: any) => {
      let subjects: string[] = [];
      let departmentsFromPrefs: string[] = [];

      const rawPrefs = alert.subject_preferences;
      if (typeof rawPrefs === 'string' && rawPrefs.trim()) {
        try {
          const parsed = JSON.parse(rawPrefs);
          if (Array.isArray(parsed)) {
            // Formato viejo: ["Matemática", "Lengua"]
            subjects = parsed.filter((x) => typeof x === 'string');
          } else if (parsed && typeof parsed === 'object') {
            // Formato nuevo: { subjects: [...], departments: [...] }
            if (Array.isArray(parsed.subjects)) {
              subjects = parsed.subjects.filter((x: unknown) => typeof x === 'string');
            }
            if (Array.isArray(parsed.departments)) {
              departmentsFromPrefs = parsed.departments.filter(
                (x: unknown) => typeof x === 'string',
              );
            }
          }
        } catch {
          // Si falla el parseo, dejamos arrays vacíos y mostramos el string solo en la tabla cruda (si hiciera falta)
        }
      }

      const mergedDepartments =
        Array.isArray(alert.departments) && alert.departments.length
          ? alert.departments
          : departmentsFromPrefs;

      return {
        ...alert,
        subject_preferences: subjects,
        departments: mergedDepartments,
      };
    });
  } catch {
    return [];
  }
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

/** Cuándo se envían las notificaciones (scheduler, etc.) */
export const fetchAlertNotificationInfo = async () => {
  const response = await api.get('/api/alert-meta/notification-info');
  return response.data;
};

export const fetchAlertHistory = async (alertId: number, limit = 100) => {
  const response = await api.get(`/api/alerts/${alertId}/history`, { params: { limit } });
  return response.data as Array<{
    id: number;
    contest_id: number;
    sent_at: string;
    status: string;
    error_message: string | null;
    contest: {
      id: number;
      title: string;
      date: string | null;
      level: string | null;
      shift: string | null;
      source_url: string | null;
      school: { name: string; city: string; department: string } | null;
      subject: { name: string } | null;
      items: Array<{ item_type: string; hours_to_cover: number | null; subject: { name: string } | null }>;
    } | null;
  }>;
};

/** Prueba de notificaciones: envía email y WhatsApp (si tiene número) con asunto y filtros en el mensaje */
export const sendTestContestNotifications = async (
  alertId: number,
  params: {
    date_from?: string;
    date_to?: string;
    departments?: string[];
    subject_ids?: number[];
    limit?: number;
  }
) => {
  const body = { ...params };
  const response = await api.post(`/api/alerts/${alertId}/test-contest-notifications`, body);
  return response.data;
};

// User API calls
export const fetchUsers = async () => {
  const response = await api.get('/api/users/');
  const data = response.data;
  return Array.isArray(data) ? data : (data?.results ?? data ?? []);
};

export const fetchUserAlerts = async (userId: number) => {
  const response = await api.get(`/api/users/${userId}/alerts/`);
  return response.data;
};

export const fetchUserContestNotifications = async (userId: number) => {
  const response = await api.get(`/api/users/${userId}/contest-notifications/`);
  return response.data;
};

/** Timeout para crear/actualizar usuario (backend puede tardar en cold start o DB). */
const USER_MUTATE_TIMEOUT_MS = 60000;

export const createUser = async (userData: any) => {
  try {
    const response = await api.post('/api/users/', userData, {
      timeout: USER_MUTATE_TIMEOUT_MS,
    });
    return response.data;
  } catch (err: any) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      throw new Error(
        'El servidor no respondió a tiempo. Compruebe que el backend esté en ejecución (cd backend && python run.py).'
      );
    }
    throw err;
  }
};

export const updateUser = async (id: number, userData: any) => {
  const response = await api.put(`/api/users/${id}`, userData, {
    timeout: USER_MUTATE_TIMEOUT_MS,
  });
  return response.data;
};

export const deleteUser = async (id: number) => {
  const response = await api.delete(`/api/users/${id}`, {
    timeout: 15000,
  });
  return response.data;
};

// Scheduler Control API calls
const DEFAULT_SCHEDULER_STATUS = {
  is_running: false,
  last_run: null as string | null,
  next_run: null as string | null,
  job_count: 0,
  available_sources: [] as string[],
  timezone: 'America/Argentina/Buenos_Aires',
  scheduled_hours: [] as number[],
  auto_sources: [] as string[],
  api_status: 'ok' as string,
};

export const getSchedulerStatus = async () => {
  try {
    const response = await api.get('/api/scheduler/status');
    return { ...DEFAULT_SCHEDULER_STATUS, ...response.data, api_status: 'ok' };
  } catch {
    return { ...DEFAULT_SCHEDULER_STATUS, api_status: 'unreachable' };
  }
};

export const runScrapingOnce = async (data: { source?: string; sources?: string[]; force?: boolean }) => {
  const response = await api.post('/api/scheduler/run-once', data);
  return response.data;
};

export const getActiveJobs = async () => {
  const response = await api.get('/api/scheduler/jobs');
  return response.data;
};

export const restartScheduler = async () => {
  const response = await api.post('/api/scheduler/restart');
  return response.data;
};

export const getSchedulerConfig = async () => {
  const response = await api.get('/api/scheduler/config');
  return response.data as {
    timezone: string;
    scheduled_hours: number[];
    auto_sources: string[];
  };
};

export const updateSchedulerConfig = async (data: {
  scheduled_hours?: number[];
  auto_sources?: string[];
}) => {
  const response = await api.post('/api/scheduler/config', data);
  return response.data as {
    timezone: string;
    scheduled_hours: number[];
    auto_sources: string[];
  };
};

export interface SchedulerHistoryRun {
  started_at: string;
  finished_at: string;
  timezone: string;
  hour_ar: number;
  sources: string[];
  total_contests: number;
  cgeCount: number;
  facebookCount: number;
}

export const getSchedulerHistory = async (limit: number = 20) => {
  const response = await api.get<{ runs: SchedulerHistoryRun[] }>(
    `/api/scheduler/history?limit=${limit}`,
  );
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
const DEFAULT_SYSTEM_STATUS = {
  api_status: 'unknown' as string,
  database: 'unknown' as string,
  scheduler: {
    is_running: false,
    last_run: null as string | null,
    next_run: null as string | null,
    available_sources: [] as string[],
  },
};

/** Timeout corto para detectar rápido si el backend está caído y mostrar el aviso. */
const STATUS_CHECK_TIMEOUT_MS = 5000;

export const fetchSystemStatus = async () => {
  try {
    const response = await api.get('/api/status', { timeout: STATUS_CHECK_TIMEOUT_MS });
    return { ...DEFAULT_SYSTEM_STATUS, ...response.data };
  } catch {
    return { ...DEFAULT_SYSTEM_STATUS, api_status: 'unreachable' };
  }
};

const DEFAULT_SCRAPING_STATUS = {
  is_running: false,
  last_run: null as string | null,
  sources: [] as any[],
  api_status: 'ok' as string,
};

export const fetchScrapingStatus = async () => {
  try {
    const response = await api.get('/api/scraping/status');
    return { ...DEFAULT_SCRAPING_STATUS, ...response.data, api_status: 'ok' };
  } catch {
    return { ...DEFAULT_SCRAPING_STATUS, api_status: 'unreachable' };
  }
};

export const triggerManualScraping = async (source?: string) => {
  const response = await api.post('/api/scraping/trigger', { source });
  return response.data;
};

export const runManualScraping = async (
  sources?: string | string[],
  options?: { send_notifications?: boolean },
) => {
  const body = Array.isArray(sources)
    ? { sources }
    : sources
      ? { source: sources }
      : {};
  // Siempre mandar boolean explícito (default true) para que el backend no dependa de undefined.
  const send_notifications = options?.send_notifications !== false;
  const payload = { ...body, send_notifications };

  const response = await api.post('/api/scraping/run', payload, {
    timeout: 120000, // 2 minutes timeout for scraping operations
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
  try {
    const response = await api.get(`/api/scraping/logs?limit=${limit}`);
    const data = response.data;
    return Array.isArray(data?.logs) ? data : { logs: data?.logs ?? [] };
  } catch {
    return { logs: [] };
  }
};

/** Progreso unificado del scraping (async o scheduler) para la barra del menú */
export interface ScrapingProgressResponse {
  running: boolean;
  source?: string | null;
  step?: string;
  percentage?: number | null;
  items_found?: number;
  items_processed?: number;
  current?: number;
  total?: number;
}

const DEFAULT_SCRAPING_PROGRESS: ScrapingProgressResponse = {
  running: false,
  step: '',
  percentage: null,
  source: null,
};

/** Timeout corto para no bloquear el menú; si el backend tarda, se usa valor por defecto. */
const SCRAPING_PROGRESS_TIMEOUT_MS = 5000;

export const fetchScrapingProgress = async (): Promise<ScrapingProgressResponse> => {
  try {
    const response = await api.get<ScrapingProgressResponse>('/api/scraping/progress', {
      timeout: SCRAPING_PROGRESS_TIMEOUT_MS,
    });
    return { ...DEFAULT_SCRAPING_PROGRESS, ...response.data };
  } catch {
    return DEFAULT_SCRAPING_PROGRESS;
  }
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
