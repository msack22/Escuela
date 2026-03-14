"""
Configuración de logging para el sistema de concursos educativos
"""

import logging
import logging.config
import os
from datetime import datetime
from pathlib import Path

# Configuración de logging
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "detailed": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(module)s:%(lineno)d - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S"
        },
        "simple": {
            "format": "%(levelname)s - %(message)s"
        },
        "json": {
            "format": '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "module": "%(module)s", "line": %(lineno)d, "message": "%(message)s"}',
            "datefmt": "%Y-%m-%d %H:%M:%S"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "detailed",
            "stream": "ext://sys.stdout"
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "DEBUG",
            "formatter": "json",
            "filename": "logs/app.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "encoding": "utf8"
        },
        "error_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "ERROR",
            "formatter": "detailed",
            "filename": "logs/error.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "encoding": "utf8"
        },
        "scraping_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "INFO",
            "formatter": "json",
            "filename": "logs/scraping.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "encoding": "utf8"
        },
        "whatsapp_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "INFO",
            "formatter": "json",
            "filename": "logs/whatsapp.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "encoding": "utf8"
        }
    },
    "loggers": {
        "": {  # Root logger
            "level": "INFO",
            "handlers": ["console", "file", "error_file"]
        },
        "app.infrastructure.scrapers": {
            "level": "DEBUG",
            "handlers": ["console", "scraping_file", "error_file"],
            "propagate": False
        },
        "app.infrastructure.notifications": {
            "level": "DEBUG",
            "handlers": ["console", "whatsapp_file", "error_file"],
            "propagate": False
        },
        "app.application.services": {
            "level": "DEBUG",
            "handlers": ["console", "file", "error_file"],
            "propagate": False
        },
        "app.api.routes": {
            "level": "INFO",
            "handlers": ["console", "file", "error_file"],
            "propagate": False
        },
        "uvicorn": {
            "level": "INFO",
            "handlers": ["console", "file"],
            "propagate": False
        },
        "sqlalchemy": {
            "level": "WARNING",
            "handlers": ["file"],
            "propagate": False
        }
    }
}


def setup_logging():
    """Configurar logging para la aplicación"""
    # Crear directorio de logs si no existe
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Configurar logging
    logging.config.dictConfig(LOGGING_CONFIG)
    
    # Logger principal
    logger = logging.getLogger(__name__)
    logger.info("Logging configurado exitosamente")
    
    return logger


class LoggerMixin:
    """Mixin para agregar logging a clases"""
    
    @property
    def logger(self):
        """Obtener logger para la clase"""
        if not hasattr(self, '_logger'):
            self._logger = logging.getLogger(self.__class__.__module__ + '.' + self.__class__.__name__)
        return self._logger
    
    def log_info(self, message, **kwargs):
        """Log informativo con contexto"""
        extra = {k: str(v) for k, v in kwargs.items()}
        self.logger.info(message, extra=extra)
    
    def log_error(self, message, error=None, **kwargs):
        """Log de error con contexto"""
        extra = {k: str(v) for k, v in kwargs.items()}
        if error:
            extra['error_type'] = type(error).__name__
            extra['error_message'] = str(error)
        self.logger.error(message, extra=extra, exc_info=True)
    
    def log_warning(self, message, **kwargs):
        """Log de advertencia con contexto"""
        extra = {k: str(v) for k, v in kwargs.items()}
        self.logger.warning(message, extra=extra)
    
    def log_debug(self, message, **kwargs):
        """Log de debug con contexto"""
        extra = {k: str(v) for k, v in kwargs.items()}
        self.logger.debug(message, extra=extra)


class PerformanceLogger:
    """Logger para medición de rendimiento"""
    
    def __init__(self, logger_name: str = "performance"):
        self.logger = logging.getLogger(logger_name)
    
    def log_execution_time(self, operation: str, duration: float, **kwargs):
        """Log de tiempo de ejecución"""
        extra = {
            'operation': operation,
            'duration_seconds': duration,
            'duration_ms': duration * 1000,
            **{k: str(v) for k, v in kwargs.items()}
        }
        self.logger.info(f"Operation completed: {operation} in {duration:.3f}s", extra=extra)
    
    def log_memory_usage(self, operation: str, memory_mb: float, **kwargs):
        """Log de uso de memoria"""
        extra = {
            'operation': operation,
            'memory_mb': memory_mb,
            **{k: str(v) for k, v in kwargs.items()}
        }
        self.logger.info(f"Memory usage for {operation}: {memory_mb:.2f} MB", extra=extra)
    
    def log_api_request(self, method: str, endpoint: str, status_code: int, duration: float, **kwargs):
        """Log de request de API"""
        extra = {
            'method': method,
            'endpoint': endpoint,
            'status_code': status_code,
            'duration_ms': duration * 1000,
            **{k: str(v) for k, v in kwargs.items()}
        }
        level = logging.INFO if status_code < 400 else logging.ERROR
        self.logger.log(level, f"{method} {endpoint} - {status_code} in {duration:.3f}s", extra=extra)
    
    def log_scraping_operation(self, source: str, contests_found: int, duration: float, **kwargs):
        """Log de operación de scraping"""
        extra = {
            'source': source,
            'contests_found': contests_found,
            'duration_seconds': duration,
            'contests_per_second': contests_found / duration if duration > 0 else 0,
            **{k: str(v) for k, v in kwargs.items()}
        }
        self.logger.info(f"Scraping {source}: {contests_found} contests in {duration:.3f}s", extra=extra)
    
    def log_whatsapp_message(self, recipient: str, status: str, duration: float, **kwargs):
        """Log de mensaje de WhatsApp"""
        extra = {
            'recipient': recipient[:4] + "****" + recipient[-2:] if len(recipient) > 4 else "****",
            'status': status,
            'duration_seconds': duration,
            **{k: str(v) for k, v in kwargs.items()}
        }
        level = logging.INFO if status == "success" else logging.ERROR
        self.logger.log(level, f"WhatsApp message to {extra['recipient']}: {status} in {duration:.3f}s", extra=extra)


class SecurityLogger:
    """Logger para eventos de seguridad"""
    
    def __init__(self, logger_name: str = "security"):
        self.logger = logging.getLogger(logger_name)
    
    def log_authentication_attempt(self, user: str, success: bool, ip_address: str, **kwargs):
        """Log de intento de autenticación"""
        extra = {
            'user': user,
            'success': success,
            'ip_address': ip_address,
            'event_type': 'authentication',
            **{k: str(v) for k, v in kwargs.items()}
        }
        level = logging.INFO if success else logging.WARNING
        self.logger.log(level, f"Auth attempt for {user}: {'success' if success else 'failed'} from {ip_address}", extra=extra)
    
    def log_data_access(self, user: str, resource: str, action: str, **kwargs):
        """Log de acceso a datos"""
        extra = {
            'user': user,
            'resource': resource,
            'action': action,
            'event_type': 'data_access',
            **{k: str(v) for k, v in kwargs.items()}
        }
        self.logger.info(f"Data access: {user} {action} {resource}", extra=extra)
    
    def log_security_event(self, event_type: str, severity: str, description: str, **kwargs):
        """Log de evento de seguridad"""
        extra = {
            'event_type': event_type,
            'severity': severity,
            'description': description,
            **{k: str(v) for k, v in kwargs.items()}
        }
        level = {
            'low': logging.INFO,
            'medium': logging.WARNING,
            'high': logging.ERROR,
            'critical': logging.CRITICAL
        }.get(severity.lower(), logging.INFO)
        self.logger.log(level, f"Security event: {event_type} - {description}", extra=extra)


# Instancias globales
performance_logger = PerformanceLogger()
security_logger = SecurityLogger()


def get_logger(name: str) -> logging.Logger:
    """Obtener logger configurado"""
    return logging.getLogger(name)


if __name__ == "__main__":
    # Demostración de logging
    setup_logging()
    
    logger = get_logger(__name__)
    logger.info("Sistema iniciado")
    
    # Demostración de LoggerMixin
    class TestService(LoggerMixin):
        def test_method(self):
            self.log_info("Test method executed", user_id=123, action="test")
            self.log_error("Test error", error=ValueError("test error"))
    
    service = TestService()
    service.test_method()
    
    # Demostración de PerformanceLogger
    performance_logger.log_execution_time("test_operation", 1.234, records=100)
    performance_logger.log_scraping_operation("test_source", 5, 2.5)
    
    # Demostración de SecurityLogger
    security_logger.log_authentication_attempt("test_user", True, "127.0.0.1")
    security_logger.log_security_event("test_event", "medium", "Test security event")
