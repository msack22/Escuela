"""
API endpoints para scraping asíncrono con alertas UI mejoradas
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import asyncio
import json

from app.application.services.async_scraping_service import (
    scraping_service, ScrapingAlert, AlertType, ScrapingStatus
)
from app.core.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix="/scraping-async", tags=["scraping-async"])

class ScrapingRequest(BaseModel):
    scraper_type: str = "modern"
    limit: Optional[int] = 10
    urls: Optional[List[str]] = None

class ScrapingCancelRequest(BaseModel):
    task_id: Optional[str] = None

# WebSocket para alertas en tiempo real
@router.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """WebSocket para recibir alertas en tiempo real"""
    await websocket.accept()
    
    # Agregar callback para enviar alertas por WebSocket
    async def websocket_callback(alert: ScrapingAlert):
        try:
            await websocket.send_text(json.dumps(alert.to_dict()))
        except:
            pass  # WebSocket cerrado
    
    scraping_service.add_alert_callback(websocket_callback)
    
    try:
        # Enviar estado inicial
        await websocket.send_text(json.dumps({
            "type": "status_update",
            "data": scraping_service.get_status()
        }))
        
        # Mantener conexión abierta
        while True:
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        pass
    finally:
        # Remover callback al desconectar
        if websocket_callback in scraping_service.alert_callbacks:
            scraping_service.alert_callbacks.remove(websocket_callback)

@router.post("/start")
async def start_scraping(request: ScrapingRequest):
    """Iniciar scraping asíncrono"""
    try:
        task_id = await scraping_service.start_scraping(
            scraper_type=request.scraper_type,
            limit=request.limit,
            urls=request.urls
        )
        
        return {
            "success": True,
            "task_id": task_id,
            "message": f"Scraping iniciado con task_id: {task_id}",
            "status": scraping_service.get_status()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cancel")
async def cancel_scraping(request: ScrapingCancelRequest):
    """Cancelar scraping actual"""
    try:
        cancelled = await scraping_service.cancel_scraping()
        
        return {
            "success": cancelled,
            "message": "Scraping cancelado" if cancelled else "No hay scraping activo",
            "status": scraping_service.get_status()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_scraping_status():
    """Obtener estado actual del scraping"""
    try:
        return {
            "success": True,
            "data": scraping_service.get_status()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/results")
async def get_scraping_results(task_id: Optional[str] = None):
    """Obtener resultados del scraping"""
    try:
        results = scraping_service.get_results(task_id)
        
        return {
            "success": True,
            "data": results,
            "total": len(results),
            "task_id": task_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/alerts")
async def get_active_alerts():
    """Obtener alertas activas"""
    try:
        return {
            "success": True,
            "data": [alert.to_dict() for alert in scraping_service.active_alerts],
            "total": len(scraping_service.active_alerts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/alerts/{alert_id}")
async def dismiss_alert(alert_id: str):
    """Cerrar alerta específica"""
    try:
        # Buscar y remover alerta
        original_count = len(scraping_service.active_alerts)
        scraping_service.active_alerts = [
            alert for alert in scraping_service.active_alerts 
            if alert.id != alert_id
        ]
        
        dismissed = len(scraping_service.active_alerts) < original_count
        
        return {
            "success": dismissed,
            "message": f"Alerta {alert_id} {'cerrada' if dismissed else 'no encontrada'}",
            "remaining_alerts": len(scraping_service.active_alerts)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/alerts")
async def clear_all_alerts():
    """Cerrar todas las alertas no persistentes"""
    try:
        original_count = len(scraping_service.active_alerts)
        
        # Mantener solo alertas persistentes
        scraping_service.active_alerts = [
            alert for alert in scraping_service.active_alerts 
            if alert.persistent
        ]
        
        cleared = original_count - len(scraping_service.active_alerts)
        
        return {
            "success": True,
            "message": f"Se cerraron {cleared} alertas temporales",
            "remaining_alerts": len(scraping_service.active_alerts)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Verificar estado del servicio de scraping"""
    return {
        "status": "healthy",
        "service": "AsyncScrapingService",
        "features": [
            "Scraping asíncrono en background",
            "Alertas en tiempo real via WebSocket",
            "UI mejorada con colores y auto-cierre",
            "Progreso detallado con estimación",
            "Múltiples scrapers",
            "Cancelación de tareas"
        ],
        "available_scrapers": list(scraping_service.scrapers.keys()),
        "current_status": scraping_service.status.value
    }
