/**
 * Configuración de logging para el frontend
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  userId?: string;
  sessionId?: string;
}

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private logLevel: LogLevel = LogLevel.INFO;
  private sessionId: string;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private setupGlobalErrorHandlers(): void {
    // Capturar errores no manejados
    window.addEventListener('error', (event) => {
      this.error('Unhandled Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    });

    // Capturar promesas rechazadas no manejadas
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled Promise Rejection', {
        reason: event.reason,
        stack: event.reason?.stack,
      });
    });
  }

  private formatMessage(level: LogLevel, category: string, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      sessionId: this.sessionId,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private log(level: LogLevel, category: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const logEntry = this.formatMessage(level, category, message, data);
    this.logs.push(logEntry);

    // Mantener solo los últimos maxLogs logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Enviar a consola con formato apropiado
    const consoleMethod = this.getConsoleMethod(level);
    const prefix = `[${logEntry.timestamp}] [${category}]`;
    
    if (data) {
      consoleMethod(prefix, message, data);
    } else {
      consoleMethod(prefix, message);
    }

    // Enviar a servicio de logging si está configurado
    this.sendToLoggingService(logEntry);
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
      default:
        return console.log;
    }
  }

  private sendToLoggingService(logEntry: LogEntry): void {
    // En producción, enviar logs a un servicio externo
    if (typeof window !== 'undefined' && (window as any).process?.env?.NODE_ENV === 'production') {
      // Ejemplo: enviar a backend, Sentry, LogRocket, etc.
      this.sendToBackend(logEntry);
    }
  }

  private async sendToBackend(logEntry: LogEntry): Promise<void> {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      // Evitar bucles infinitos de logging
      console.error('Failed to send log to backend:', error);
    }
  }

  // Métodos públicos de logging
  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  // Métodos especializados
  api(method: string, url: string, status: number, duration: number, data?: any): void {
    this.info('API', `${method} ${url}`, {
      status,
      duration,
      url,
      method,
      ...data,
    });
  }

  userAction(action: string, data?: any): void {
    this.info('USER', action, data);
  }

  performance(operation: string, duration: number, data?: any): void {
    this.info('PERFORMANCE', `${operation} completed in ${duration}ms`, {
      operation,
      duration,
      ...data,
    });
  }

  scraping(source: string, contestsFound: number, duration: number, data?: any): void {
    this.info('SCRAPING', `${source}: ${contestsFound} contests found`, {
      source,
      contestsFound,
      duration,
      ...data,
    });
  }

  whatsapp(recipient: string, status: string, duration: number, data?: any): void {
    this.info('WHATSAPP', `Message to ${recipient}: ${status}`, {
      recipient: this.maskPhone(recipient),
      status,
      duration,
      ...data,
    });
  }

  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', data?: any): void {
    const level = severity === 'critical' ? LogLevel.ERROR : 
                  severity === 'high' ? LogLevel.ERROR :
                  severity === 'medium' ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, 'SECURITY', event, {
      event,
      severity,
      ...data,
    });
  }

  // Métodos de utilidad
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info('LOGGER', `Log level set to ${LogLevel[level]}`);
  }

  getLogs(category?: string, level?: LogLevel): LogEntry[] {
    return this.logs.filter(log => {
      if (category && log.category !== category) return false;
      if (level !== undefined && log.level !== level) return false;
      return true;
    });
  }

  clearLogs(): void {
    this.logs = [];
    this.info('LOGGER', 'Logs cleared');
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  private maskPhone(phone: string): string {
    if (phone.length <= 4) return '****';
    return phone.substring(0, 4) + '****' + phone.substring(phone.length - 2);
  }

  // Métodos para medir rendimiento
  usePerformanceLogger(operation: string) {
    const startTime = Date.now();
    
    return {
      end: (data?: any) => {
        const duration = Date.now() - startTime;
        this.performance(operation, duration, data);
        return duration;
      },
    };
  }

  useApiLogger(method: string, url: string) {
    const startTime = Date.now();
    
    return {
      success: (status: number, data?: any) => {
        const duration = Date.now() - startTime;
        this.api(method, url, status, duration, data);
      },
      error: (status: number, error?: any) => {
        const duration = Date.now() - startTime;
        this.error('API', `${method} ${url} failed`, {
          status,
          duration,
          error,
        });
      },
    };
  }
}

// Logger global
export const logger = Logger.getInstance();

// Hook personalizado para React (si está disponible)
export const useLogger = (category: string) => {
  return {
    debug: (message: string, data?: any) => logger.debug(category, message, data),
    info: (message: string, data?: any) => logger.info(category, message, data),
    warn: (message: string, data?: any) => logger.warn(category, message, data),
    error: (message: string, data?: any) => logger.error(category, message, data),
    performance: (operation: string, duration: number, data?: any) => 
      logger.performance(operation, duration, data),
  };
};

// Hook para medir rendimiento
export const usePerformanceLogger = (operation: string) => {
  return logger.usePerformanceLogger(operation);
};

// Hook para logging de API
export const useApiLogger = (method: string, url: string) => {
  return logger.useApiLogger(method, url);
};

export default logger;
