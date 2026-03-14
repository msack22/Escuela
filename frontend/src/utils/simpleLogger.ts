/**
 * Sistema de Logging Simple para Frontend
 * Captura errores automáticamente y los envía al backend
 */

// Variables globales para el logging
let logs: any[] = [];
let sessionId: string = '';

// Inicializar el logger
function initLogger() {
  // Generar ID de sesión
  sessionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  // Capturar errores globales
  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handlePromiseRejection);
  
  // Sobrescribir console.error
  const originalError = console.error;
  console.error = (...args: any[]) => {
    originalError.apply(console, args);
    logError('error', args.join(' '), { type: 'console_error' });
  };
  
  // Enviar logs cada 30 segundos
  setInterval(() => flushLogs(), 30000);
  
  // Enviar logs al cerrar
  window.addEventListener('beforeunload', flushLogs);
}

// Manejar errores globales
function handleGlobalError(event: any) {
  logError('error', event.message, {
    type: 'global_error',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack
  });
}

// Manejar promesas rechazadas
function handlePromiseRejection(event: any) {
  logError('error', 'Unhandled Promise Rejection', {
    type: 'promise_rejection',
    reason: event.reason?.message || event.reason,
    stack: event.reason?.stack
  });
}

// Función principal de logging
function logError(level: string, message: string, metadata: any = {}) {
  const logEntry = {
    id: Date.now() + Math.random(),
    level,
    message,
    metadata,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    sessionId
  };
  
  // Agregar a logs en memoria
  logs.push(logEntry);
  
  // Mantener máximo 1000 logs
  if (logs.length > 1000) {
    logs = logs.slice(-1000);
  }
  
  // Guardar en localStorage
  saveToLocalStorage(logEntry);
  
  // Si es error crítico, enviar inmediatamente
  if (level === 'error') {
    sendToServer([logEntry]);
  }
  
  // Mostrar en consola con formato
  const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
  console.log(`%c[${level.toUpperCase()}] ${timestamp}`, 
    'color: #ff4444; font-weight: bold;', 
    message, 
    metadata);
}

// Guardar en localStorage
function saveToLocalStorage(logEntry: any) {
  try {
    const key = 'frontend_logs';
    const existingLogs = JSON.parse(localStorage.getItem(key) || '[]');
    existingLogs.push(logEntry);
    
    // Mantener solo últimos 500 logs
    if (existingLogs.length > 500) {
      existingLogs.splice(0, existingLogs.length - 500);
    }
    
    localStorage.setItem(key, JSON.stringify(existingLogs));
  } catch (e) {
    console.warn('No se pudo guardar log en localStorage:', e);
  }
}

// Enviar logs al servidor
async function sendToServer(logsToSend: any[]) {
  try {
    const response = await fetch('/api/logs/frontend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        logs: logsToSend,
        clientInfo: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          sessionId
        }
      })
    });

    if (!response.ok) {
      console.warn('Error al enviar logs al servidor:', response.status);
    }
  } catch (e) {
    console.warn('Error de red al enviar logs:', e);
  }
}

// Enviar todos los logs al servidor
async function flushLogs() {
  if (logs.length === 0) return;
  
  const logsToSend = [...logs];
  logs = []; // Limpiar logs en memoria
  
  await sendToServer(logsToSend);
}

// Métodos públicos
export const simpleLogger = {
  error: (message: string, metadata: any = {}) => logError('error', message, metadata),
  warn: (message: string, metadata: any = {}) => logError('warn', message, metadata),
  info: (message: string, metadata: any = {}) => logError('info', message, metadata),
  apiError: (error: any, requestInfo: any = {}) => {
    logError('error', 'API Error', {
      type: 'api_error',
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      request: requestInfo
    });
  },
  getLogs: () => [...logs],
  clearLogs: () => {
    logs = [];
    localStorage.removeItem('frontend_logs');
  }
};

// Inicializar automáticamente
initLogger();

// Exponer globalmente
(window as any).simpleLogger = simpleLogger;
