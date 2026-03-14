"""
Endpoint para recibir logs del frontend
"""

import logging
import json
from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os

router = APIRouter()

# Configurar logger para frontend logs
frontend_logger = logging.getLogger('frontend')
frontend_logger.setLevel(logging.INFO)

# Crear handler para logs del frontend
log_dir = 'logs/frontend'
os.makedirs(log_dir, exist_ok=True)

# File handler para frontend logs
frontend_handler = logging.FileHandler(f'{log_dir}/frontend.log', encoding='utf-8')
frontend_handler.setLevel(logging.INFO)

# Formatter para frontend logs
frontend_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
frontend_handler.setFormatter(frontend_formatter)

frontend_logger.addHandler(frontend_handler)

class LogEntry(BaseModel):
    id: float
    level: str
    message: str
    metadata: Dict[str, Any]
    timestamp: str
    url: str
    userAgent: str

class FrontendLogRequest(BaseModel):
    logs: List[LogEntry]
    clientInfo: Dict[str, Any]

@router.post("/frontend")
async def receive_frontend_logs(request: FrontendLogRequest):
    """Recibir logs del frontend y guardarlos en archivos"""
    try:
        # Procesar cada log entry
        for log_entry in request.logs:
            # Formatear mensaje con metadata
            message = f"{log_entry.message}"
            if log_entry.metadata:
                message += f" | Metadata: {json.dumps(log_entry.metadata, separators=(',', ':'))}"
            
            # Loggear con el nivel correspondiente
            log_level = getattr(logging, log_entry.level.upper(), logging.INFO)
            
            frontend_logger.log(
                log_level,
                message,
                extra={
                    'url': log_entry.url,
                    'user_agent': log_entry.userAgent,
                    'timestamp': log_entry.timestamp,
                    'client_info': request.clientInfo
                }
            )
        
        # También guardar en archivo JSON para análisis posterior
        await save_logs_to_file(request)
        
        return {"status": "success", "logs_received": len(request.logs)}
        
    except Exception as e:
        frontend_logger.error(f"Error processing frontend logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing logs")

async def save_logs_to_file(request: FrontendLogRequest):
    """Guardar logs en archivo JSON para análisis"""
    try:
        # Crear archivo de logs por fecha
        date_str = datetime.now().strftime('%Y-%m-%d')
        log_file = f'{log_dir}/frontend_{date_str}.json'
        
        # Leer logs existentes
        existing_logs = []
        if os.path.exists(log_file):
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    existing_logs = json.load(f)
            except:
                existing_logs = []
        
        # Agregar nuevos logs
        new_logs = []
        for log_entry in request.logs:
            new_logs.append({
                **log_entry.dict(),
                'client_info': request.clientInfo,
                'server_timestamp': datetime.now().isoformat()
            })
        
        # Guardar todos los logs
        all_logs = existing_logs + new_logs
        
        # Mantener solo últimos 1000 logs por día
        if len(all_logs) > 1000:
            all_logs = all_logs[-1000:]
        
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump(all_logs, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        frontend_logger.error(f"Error saving logs to file: {str(e)}")

@router.get("/frontend/status")
async def get_frontend_logs_status():
    """Obtener estado de los logs del frontend"""
    try:
        # Contar logs por nivel
        log_stats = {
            'total': 0,
            'error': 0,
            'warn': 0,
            'info': 0,
            'debug': 0
        }
        
        # Leer logs del día actual
        date_str = datetime.now().strftime('%Y-%m-%d')
        log_file = f'{log_dir}/frontend_{date_str}.json'
        
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8') as f:
                logs = json.load(f)
                
                for log_entry in logs:
                    log_stats['total'] += 1
                    level = log_entry.get('level', 'info')
                    if level in log_stats:
                        log_stats[level] += 1
        
        # Información de archivos
        file_info = {
            'log_directory': log_dir,
            'current_log_file': log_file,
            'file_exists': os.path.exists(log_file),
            'file_size': os.path.getsize(log_file) if os.path.exists(log_file) else 0
        }
        
        return {
            'stats': log_stats,
            'file_info': file_info,
            'last_updated': datetime.now().isoformat()
        }
        
    except Exception as e:
        frontend_logger.error(f"Error getting frontend logs status: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting logs status")

@router.get("/frontend/recent")
async def get_recent_frontend_logs(limit: int = 50):
    """Obtener logs recientes del frontend"""
    try:
        # Leer logs del día actual
        date_str = datetime.now().strftime('%Y-%m-%d')
        log_file = f'{log_dir}/frontend_{date_str}.json'
        
        if not os.path.exists(log_file):
            return {"logs": [], "total": 0}
        
        with open(log_file, 'r', encoding='utf-8') as f:
            logs = json.load(f)
        
        # Ordenar por timestamp (más recientes primero)
        logs.sort(key=lambda x: x.get('server_timestamp', x.get('timestamp')), reverse=True)
        
        # Limitar cantidad
        recent_logs = logs[:limit]
        
        return {
            "logs": recent_logs,
            "total": len(logs),
            "showing": len(recent_logs)
        }
        
    except Exception as e:
        frontend_logger.error(f"Error getting recent frontend logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting recent logs")

@router.delete("/frontend")
async def clear_frontend_logs():
    """Limpiar logs del frontend"""
    try:
        # Eliminar archivos de logs
        import glob
        log_files = glob.glob(f'{log_dir}/*.json')
        log_files.extend(glob.glob(f'{log_dir}/*.log'))
        
        deleted_files = []
        for file_path in log_files:
            try:
                os.remove(file_path)
                deleted_files.append(file_path)
            except:
                pass
        
        return {
            "status": "success",
            "deleted_files": deleted_files,
            "message": f"Deleted {len(deleted_files)} log files"
        }
        
    except Exception as e:
        frontend_logger.error(f"Error clearing frontend logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Error clearing logs")
