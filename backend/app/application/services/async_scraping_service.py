"""
Sistema de scraping asíncrono en background con alertas UI mejoradas
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
import json

from app.infrastructure.scrapers.modern_scrapling_scraper import ModernScraplingScraper
from app.infrastructure.scrapers.educacion_gob_scraper import EducacionGobScraper
from app.core.logging_config import LoggerMixin, performance_logger

class ScrapingStatus(Enum):
    """Estados del proceso de scraping"""
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"

class AlertType(Enum):
    """Tipos de alertas"""
    SUCCESS = "success"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"

@dataclass
class ScrapingAlert:
    """Alerta de scraping con metadata UI"""
    id: str
    type: AlertType
    title: str
    message: str
    timestamp: datetime
    auto_close: bool = True
    auto_close_seconds: int = 10
    persistent: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convertir a diccionario para API"""
        return {
            "id": self.id,
            "type": self.type.value,
            "title": self.title,
            "message": self.message,
            "timestamp": self.timestamp.isoformat(),
            "auto_close": self.auto_close,
            "auto_close_seconds": self.auto_close_seconds,
            "persistent": self.persistent,
            "metadata": self.metadata,
            "ui_config": self._get_ui_config()
        }
    
    def _get_ui_config(self) -> Dict[str, Any]:
        """Configuración UI según tipo de alerta"""
        configs = {
            AlertType.SUCCESS: {
                "color": "#10b981",  # verde
                "bg_color": "#dcfce7",
                "border_color": "#22c55e",
                "icon": "✅",
                "show_progress": True
            },
            AlertType.ERROR: {
                "color": "#ef4444",  # rojo
                "bg_color": "#fee2e2",
                "border_color": "#f87171",
                "icon": "❌",
                "show_progress": False
            },
            AlertType.WARNING: {
                "color": "#f59e0b",  # amarillo
                "bg_color": "#fef3c7",
                "border_color": "#fbbf24",
                "icon": "⚠️",
                "show_progress": False
            },
            AlertType.INFO: {
                "color": "#3b82f6",  # azul
                "bg_color": "#dbeafe",
                "border_color": "#60a5fa",
                "icon": "ℹ️",
                "show_progress": False
            }
        }
        return configs.get(self.type, configs[AlertType.INFO])

@dataclass
class ScrapingProgress:
    """Progreso del scraping"""
    current_step: str
    total_steps: int
    current_step_index: int
    percentage: int
    items_found: int = 0
    items_processed: int = 0
    start_time: datetime = field(default_factory=datetime.now)
    estimated_completion: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convertir a diccionario para API"""
        return {
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "current_step_index": self.current_step_index,
            "percentage": self.percentage,
            "items_found": self.items_found,
            "items_processed": self.items_processed,
            "start_time": self.start_time.isoformat(),
            "estimated_completion": self.estimated_completion.isoformat() if self.estimated_completion else None,
            "elapsed_time": (datetime.now() - self.start_time).total_seconds()
        }

class AsyncScrapingService(LoggerMixin):
    """Servicio de scraping asíncrono con alertas mejoradas"""
    
    def __init__(self):
        self.status = ScrapingStatus.IDLE
        self.current_task: Optional[asyncio.Task] = None
        self.current_progress: Optional[ScrapingProgress] = None
        self.active_alerts: List[ScrapingAlert] = []
        self.scraping_results: List[Dict[str, Any]] = []
        self.alert_callbacks: List[callable] = []
        
        # Scrapers disponibles
        self.scrapers = {
            "modern": ModernScraplingScraper(),
            "legacy": EducacionGobScraper()
        }
    
    def add_alert_callback(self, callback: callable):
        """Agregar callback para notificar alertas"""
        self.alert_callbacks.append(callback)
    
    async def _notify_alert(self, alert: ScrapingAlert):
        """Notificar alerta a todos los callbacks"""
        self.active_alerts.append(alert)
        
        # Notificar a todos los callbacks
        for callback in self.alert_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(alert)
                else:
                    callback(alert)
            except Exception as e:
                self.log_error("Error en alert callback", error=e)
        
        # Auto-cerrar alerta no persistente
        if alert.auto_close and not alert.persistent:
            await asyncio.sleep(alert.auto_close_seconds)
            self.active_alerts = [a for a in self.active_alerts if a.id != alert.id]
            await self._notify_alert(ScrapingAlert(
                id=f"{alert.id}_close",
                type=AlertType.INFO,
                title="Alerta cerrada automáticamente",
                message=f"La alerta '{alert.title}' fue cerrada automáticamente",
                timestamp=datetime.now(),
                auto_close=False,
                auto_close_seconds=2
            ))
    
    async def start_scraping(self, scraper_type: str = "modern", limit: Optional[int] = None, 
                           urls: Optional[List[str]] = None) -> str:
        """Iniciar scraping en background"""
        if self.status == ScrapingStatus.RUNNING:
            await self._notify_alert(ScrapingAlert(
                id="already_running",
                type=AlertType.WARNING,
                title="Scraping en curso",
                message="Ya hay un proceso de scraping en ejecución",
                timestamp=datetime.now(),
                auto_close_seconds=5
            ))
            return "already_running"
        
        # Generar ID de tarea
        task_id = f"scraping_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Crear tarea asíncrona
        self.current_task = asyncio.create_task(
            self._scraping_worker(task_id, scraper_type, limit, urls)
        )
        
        return task_id
    
    async def _scraping_worker(self, task_id: str, scraper_type: str, 
                             limit: Optional[int], urls: Optional[List[str]]):
        """Worker asíncrono de scraping"""
        try:
            self.status = ScrapingStatus.RUNNING
            
            # Alerta de inicio
            await self._notify_alert(ScrapingAlert(
                id=f"{task_id}_start",
                type=AlertType.INFO,
                title="Scraping iniciado",
                message=f"Iniciando proceso de scraping con {scraper_type}",
                timestamp=datetime.now(),
                auto_close_seconds=3,
                metadata={"task_id": task_id, "scraper_type": scraper_type}
            ))
            
            # Inicializar progreso
            self.current_progress = ScrapingProgress(
                current_step="Iniciando scraper",
                total_steps=4,
                current_step_index=0,
                percentage=0
            )
            
            # Paso 1: Inicialización
            await self._update_progress("Iniciando scraper", 1)
            scraper = self.scrapers.get(scraper_type)
            if not scraper:
                raise ValueError(f"Scraper {scraper_type} no encontrado")
            
            # Paso 2: Obtener URLs
            await self._update_progress("Obteniendo URLs", 2)
            if urls:
                target_urls = urls
            else:
                target_urls = [scraper.base_url]
            
            # Paso 3: Ejecutar scraping
            await self._update_progress("Ejecutando scraping", 3)
            all_contests = []
            
            for i, url in enumerate(target_urls):
                await self._update_progress(
                    f"Scraping: {url}", 
                    3, 
                    items_found=len(all_contests)
                )
                
                # Actualizar URL del scraper si es necesario
                scraper.base_url = url
                contests = await scraper.scrape_contests(limit=limit)
                all_contests.extend(contests)
                
                # Alerta de progreso
                await self._notify_alert(ScrapingAlert(
                    id=f"{task_id}_progress_{i}",
                    type=AlertType.INFO,
                    title=f"Scraping {i+1}/{len(target_urls)}",
                    message=f"URL {url}: {len(contests)} concursos encontrados",
                    timestamp=datetime.now(),
                    auto_close_seconds=2,
                    metadata={"url": url, "contests": len(contests)}
                ))
            
            # Paso 4: Finalización
            await self._update_progress("Finalizando", 4, items_processed=len(all_contests))
            
            # Guardar resultados
            self.scraping_results = [
                {
                    "task_id": task_id,
                    "scraper_type": scraper_type,
                    "timestamp": datetime.now().isoformat(),
                    "total_contests": len(all_contests),
                    "contests": [
                        {
                            "title": c.title,
                            "institution": c.institution,
                            "location": c.location,
                            "deadline": c.deadline.isoformat() if c.deadline else None,
                            "source_url": c.source_url
                        } for c in all_contests
                    ]
                }
            ]
            
            # Alerta de éxito
            await self._notify_alert(ScrapingAlert(
                id=f"{task_id}_success",
                type=AlertType.SUCCESS,
                title="✅ Scraping completado",
                message=f"Se encontraron {len(all_contests)} concursos exitosamente",
                timestamp=datetime.now(),
                auto_close_seconds=15,
                persistent=True,
                metadata={
                    "task_id": task_id,
                    "total_contests": len(all_contests),
                    "scraper_type": scraper_type,
                    "execution_time": (datetime.now() - self.current_progress.start_time).total_seconds()
                }
            ))
            
            self.status = ScrapingStatus.COMPLETED
            
        except Exception as e:
            self.status = ScrapingStatus.ERROR
            
            # Alerta de error
            await self._notify_alert(ScrapingAlert(
                id=f"{task_id}_error",
                type=AlertType.ERROR,
                title="❌ Error en scraping",
                message=f"Error durante el scraping: {str(e)}",
                timestamp=datetime.now(),
                auto_close_seconds=20,
                persistent=True,
                metadata={
                    "task_id": task_id,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            ))
            
            self.log_error("Error en scraping worker", error=e, task_id=task_id)
        
        finally:
            self.current_task = None
            self.current_progress = None
    
    async def _update_progress(self, step: str, step_index: int, 
                           items_found: int = 0, items_processed: int = 0):
        """Actualizar progreso del scraping"""
        if self.current_progress:
            self.current_progress.current_step = step
            self.current_progress.current_step_index = step_index
            self.current_progress.percentage = int((step_index / self.current_progress.total_steps) * 100)
            self.current_progress.items_found = items_found
            self.current_progress.items_processed = items_processed
            
            # Calcular tiempo estimado
            elapsed = (datetime.now() - self.current_progress.start_time).total_seconds()
            if elapsed > 0 and self.current_progress.percentage > 0:
                total_estimated = elapsed * (100 / self.current_progress.percentage)
                remaining = total_estimated - elapsed
                self.current_progress.estimated_completion = datetime.now() + timedelta(seconds=remaining)
    
    async def cancel_scraping(self) -> bool:
        """Cancelar scraping actual"""
        if self.current_task and not self.current_task.done():
            self.current_task.cancel()
            self.status = ScrapingStatus.CANCELLED
            
            await self._notify_alert(ScrapingAlert(
                id="cancelled",
                type=AlertType.WARNING,
                title="Scraping cancelado",
                message="El proceso de scraping fue cancelado",
                timestamp=datetime.now(),
                auto_close_seconds=5
            ))
            
            return True
        return False
    
    def get_status(self) -> Dict[str, Any]:
        """Obtener estado actual del scraping"""
        return {
            "status": self.status.value,
            "progress": self.current_progress.to_dict() if self.current_progress else None,
            "active_alerts": [alert.to_dict() for alert in self.active_alerts],
            "recent_results": self.scraping_results[-5:],  # Últimos 5 resultados
            "available_scrapers": list(self.scrapers.keys())
        }
    
    def get_results(self, task_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Obtener resultados del scraping"""
        if task_id:
            return [r for r in self.scraping_results if r["task_id"] == task_id]
        return self.scraping_results

# Instancia global del servicio
scraping_service = AsyncScrapingService()
