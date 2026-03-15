from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.infrastructure.scrapers.scraper_factory import ScrapingService
from app.application.services.scheduler_service import ScrapingScheduler

router = APIRouter()
logger = logging.getLogger(__name__)

# Global variables para manejar el scheduler
scheduler_instance = None
scraping_service_instance = None

class SchedulerStatus(BaseModel):
    is_running: bool
    last_run: str = None
    next_run: str = None
    available_sources: list = []
    job_count: int = 0

class JobRequest(BaseModel):
    source: str = None
    force: bool = False

def get_scheduler_instance():
    """Obtener instancia del scheduler (singleton)"""
    global scheduler_instance
    if scheduler_instance is None:
        scheduler_instance = ScrapingScheduler()
    return scheduler_instance

def get_scraping_service():
    """Obtener instancia del scraping service"""
    global scraping_service_instance
    if scraping_service_instance is None:
        scraping_service_instance = ScrapingService()
    return scraping_service_instance

@router.get("/status", response_model=SchedulerStatus)
async def get_scheduler_status():
    """Obtener estado actual del scheduler"""
    try:
        scheduler = get_scheduler_instance()
        scraping_service = get_scraping_service()
        
        return SchedulerStatus(
            is_running=scheduler.is_running(),
            last_run=scheduler.get_last_run_time(),
            next_run=scheduler.get_next_run_time(),
            available_sources=scraping_service.get_available_sources(),
            job_count=len(scheduler.get_active_jobs()) if hasattr(scheduler, 'get_active_jobs') else 0
        )
    except Exception as e:
        logger.error(f"Error getting scheduler status: {e}")
        return SchedulerStatus(
            is_running=False,
            available_sources=[],
            job_count=0
        )

@router.post("/start")
async def start_scheduler(background_tasks: BackgroundTasks):
    """Iniciar el scheduler manualmente"""
    try:
        scheduler = get_scheduler_instance()
        
        if scheduler.is_running():
            return {"message": "Scheduler is already running", "status": "already_running"}
        
        # Iniciar scheduler en background
        background_tasks.add_task(scheduler.start)
        
        logger.info("Scheduler started manually")
        return {"message": "Scheduler started successfully", "status": "started"}
    except Exception as e:
        logger.error(f"Error starting scheduler: {e}")
        raise HTTPException(status_code=500, detail=f"Error starting scheduler: {str(e)}")

@router.post("/stop")
async def stop_scheduler():
    """Detener el scheduler manualmente"""
    try:
        scheduler = get_scheduler_instance()
        
        if not scheduler.is_running():
            return {"message": "Scheduler is not running", "status": "not_running"}
        
        await scheduler.stop()
        
        logger.info("Scheduler stopped manually")
        return {"message": "Scheduler stopped successfully", "status": "stopped"}
    except Exception as e:
        logger.error(f"Error stopping scheduler: {e}")
        raise HTTPException(status_code=500, detail=f"Error stopping scheduler: {str(e)}")

@router.post("/run-once")
async def run_scraping_once(job_request: JobRequest, background_tasks: BackgroundTasks):
    """Ejecutar scraping una sola vez"""
    try:
        scraping_service = get_scraping_service()
        
        # Ejecutar scraping en background
        background_tasks.add_task(
            run_single_scraping_job,
            job_request.source,
            job_request.force
        )
        
        logger.info(f"Single scraping job started for source: {job_request.source}")
        return {
            "message": "Scraping job started successfully",
            "source": job_request.source,
            "force": job_request.force
        }
    except Exception as e:
        logger.error(f"Error starting scraping job: {e}")
        raise HTTPException(status_code=500, detail=f"Error starting scraping job: {str(e)}")

async def run_single_scraping_job(source: str = None, force: bool = False):
    """Ejecutar un solo job de scraping"""
    try:
        scraping_service = get_scraping_service()
        
        if not source:
            # Ejecutar todos los sources disponibles
            sources = scraping_service.get_available_sources()
            for src in sources:
                await scraping_service.scrape_source(src, force=force)
        else:
            # Ejecutar source específico
            await scraping_service.scrape_source(source, force=force)
        
        logger.info(f"Scraping job completed for source: {source}")
    except Exception as e:
        logger.error(f"Error in scraping job: {e}")

@router.get("/jobs")
async def get_active_jobs():
    """Obtener lista de jobs activos"""
    try:
        scheduler = get_scheduler_instance()
        
        if hasattr(scheduler, 'get_active_jobs'):
            jobs = scheduler.get_active_jobs()
            return {
                "active_jobs": jobs,
                "count": len(jobs)
            }
        else:
            return {
                "active_jobs": [],
                "count": 0
            }
    except Exception as e:
        logger.error(f"Error getting active jobs: {e}")
        return {"active_jobs": [], "count": 0}

@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
    """Cancelar un job específico"""
    try:
        scheduler = get_scheduler_instance()
        
        if hasattr(scheduler, 'cancel_job'):
            success = scheduler.cancel_job(job_id)
            if success:
                return {"message": f"Job {job_id} cancelled successfully"}
            else:
                return {"message": f"Job {job_id} not found or already completed"}
        else:
            return {"message": "Job cancellation not supported"}
    except Exception as e:
        logger.error(f"Error cancelling job: {e}")
        raise HTTPException(status_code=500, detail=f"Error cancelling job: {str(e)}")

@router.post("/restart")
async def restart_scheduler(background_tasks: BackgroundTasks):
    """Reiniciar el scheduler completamente"""
    try:
        scheduler = get_scheduler_instance()
        
        # Detener si está corriendo
        if scheduler.is_running():
            await scheduler.stop()
            logger.info("Scheduler stopped for restart")
        
        # Pequeña pausa antes de reiniciar
        import asyncio
        await asyncio.sleep(2)
        
        # Reiniciar en background
        background_tasks.add_task(scheduler.start)
        
        logger.info("Scheduler restarted successfully")
        return {"message": "Scheduler restarted successfully", "status": "restarted"}
    except Exception as e:
        logger.error(f"Error restarting scheduler: {e}")
        raise HTTPException(status_code=500, detail=f"Error restarting scheduler: {str(e)}")
