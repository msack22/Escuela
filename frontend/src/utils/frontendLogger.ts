/**
 * Sistema de Logging Automático de Errores del Frontend
 * Captura errores de JavaScript, errores de API, y advertencias
 * Los guarda en archivos logs para análisis posterior
 */

interface LogEntry {
  id: number;
  level: string;
  message: string;
  metadata: any;
  timestamp: string;
  url: string;
  userAgent: string;
}

interface ClientInfo {
  userAgent: string;
  url: string;
  timestamp: string;
  sessionId: string;
}

declare global {
  interface Window {
    reactErrorBoundary?: (error: Error, errorInfo: any) => void;
    frontendLogger?: FrontendLogger;
  }
}

class FrontendLogger {
  private logLevel: string;
  private logUrl: string;
  private maxLogSize: number;
  private logs: LogEntry[];

  constructor() {
    this.logLevel = localStorage.getItem('log_level') || 'error';
    this.logUrl = (window as any).process?.env?.REACT_APP_LOG_URL || '/api/logs/frontend';
    this.maxLogSize = 1000;
    this.logs = [];
    this.init();
  }

  init() {
    // Capturar errores no manejados
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this));
    
    // Sobrescribir console.error y console.warn
    this.overrideConsole();
    
    // Capturar errores de React
    this.setupReactErrorBoundary();
    
    // Enviar logs periodicamente al servidor
    setInterval(() => this.flushLogs(), 30000); // Cada 30 segundos
    
    // Enviar logs al cerrar la página
    window.addEventListener('beforeunload', () => this.flushLogs());
  }

  overrideConsole() {
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalLog = console.log;

    console.error = (...args) => {
      originalError.apply(console, args);
      this.log('error', args.join(' '), { type: 'console_error', stack: this.getStack() });
    };

    console.warn = (...args) => {
      originalWarn.apply(console, args);
      this.log('warn', args.join(' '), { type: 'console_warn', stack: this.getStack() });
    };

    console.log = (...args) => {
      originalLog.apply(console, args);
      this.log('info', args.join(' '), { type: 'console_log', stack: this.getStack() });
    };
  }

  handleGlobalError(event) {
    const error = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.log('error', event.message, error);
  }

  handlePromiseRejection(event) {
    const error = {
      message: event.reason?.message || 'Unhandled Promise Rejection',
      stack: event.reason?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      reason: event.reason
    };

    this.log('error', 'Unhandled Promise Rejection', error);
  }

  setupReactErrorBoundary() {
    // Para React Error Boundary
    window.reactErrorBoundary = (error, errorInfo) => {
      const reactError = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      this.log('error', 'React Error Boundary', reactError);
    };
  }

  log(level, message, metadata = {}) {
    const logEntry = {
      id: Date.now() + Math.random(),
      level,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // Agregar a logs en memoria
    this.logs.push(logEntry);
    
    // Mantener tamaño máximo
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    // Guardar en localStorage
    this.saveToLocalStorage(logEntry);

    // Si es error crítico, enviar inmediatamente
    if (level === 'error') {
      this.sendToServer([logEntry]);
    }

    // Mostrar en consola con formato
    this.formatConsoleLog(logEntry);
  }

  formatConsoleLog(logEntry) {
    const prefix = `[${logEntry.level.toUpperCase()}] ${new Date(logEntry.timestamp).toLocaleTimeString()}`;
    const style = this.getLogStyle(logEntry.level);
    
    console.log(`%c${prefix}`, style, logEntry.message, logEntry.metadata);
  }

  getLogStyle(level) {
    const styles = {
      error: 'color: #ff4444; font-weight: bold; background: #ffeeee; padding: 2px 4px; border-radius: 3px;',
      warn: 'color: #ff8800; font-weight: bold; background: #fff8ee; padding: 2px 4px; border-radius: 3px;',
      info: 'color: #0088ff; font-weight: bold; background: #eef8ff; padding: 2px 4px; border-radius: 3px;',
      debug: 'color: #888888; font-weight: bold; background: #f8f8f8; padding: 2px 4px; border-radius: 3px;'
    };
    return styles[level] || styles.info;
  }

  saveToLocalStorage(logEntry) {
    try {
      const key = 'frontend_logs';
      const existingLogs = JSON.parse(localStorage.getItem(key) || '[]');
      existingLogs.push(logEntry);
      
      // Mantener solo últimos 500 logs en localStorage
      if (existingLogs.length > 500) {
        existingLogs.splice(0, existingLogs.length - 500);
      }
      
      localStorage.setItem(key, JSON.stringify(existingLogs));
    } catch (e) {
      console.warn('No se pudo guardar log en localStorage:', e);
    }
  }

  async sendToServer(logs) {
    try {
      const response = await fetch(this.logUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs,
          clientInfo: {
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId()
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

  async flushLogs() {
    if (this.logs.length === 0) return;

    const logsToSend = [...this.logs];
    this.logs = []; // Limpiar logs en memoria

    await this.sendToServer(logsToSend);
  }

  getSessionId() {
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  }

  getStack() {
    try {
      throw new Error();
    } catch (e) {
      return e.stack;
    }
  }

  // Métodos públicos
  error(message, metadata = {}) {
    this.log('error', message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  debug(message, metadata = {}) {
    if (this.logLevel === 'debug') {
      this.log('debug', message, metadata);
    }
  }

  // Para errores de API específicamente
  apiError(error, requestInfo = {}) {
    this.log('error', 'API Error', {
      type: 'api_error',
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      request: requestInfo,
      stack: error.stack
    });
  }

  // Para errores de red
  networkError(error, requestInfo = {}) {
    this.log('error', 'Network Error', {
      type: 'network_error',
      url: error.config?.url,
      method: error.config?.method,
      message: error.message,
      code: error.code,
      request: requestInfo,
      stack: error.stack
    });
  }

  // Obtener logs para análisis
  getLogs(level = null) {
    const allLogs = [
      ...JSON.parse(localStorage.getItem('frontend_logs') || '[]'),
      ...this.logs
    ];

    if (level) {
      return allLogs.filter(log => log.level === level);
    }

    return allLogs;
  }

  // Limpiar logs
  clearLogs() {
    this.logs = [];
    localStorage.removeItem('frontend_logs');
  }

  // Exportar logs
  exportLogs() {
    const logs = this.getLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `frontend-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Crear instancia global
const frontendLogger = new FrontendLogger();

// Exponer para uso en componentes
window.frontendLogger = frontendLogger;

export default frontendLogger;
