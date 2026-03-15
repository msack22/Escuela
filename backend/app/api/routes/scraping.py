from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.application.services.scheduler_service import get_scheduler

router = APIRouter()


@router.post("/run-datos-abiertos")
async def run_datos_abiertos_scraping():
    """Ejecutar scraping de API de Datos Abiertos de Argentina"""
    try:
        from app.infrastructure.scrapers.scraper_factory import ScraperFactory
        factory = ScraperFactory()
        scraper = factory.create_scraper("datos_abiertos_argentina")
        
        if not await scraper.is_available():
            raise HTTPException(status_code=503, detail="API de Datos Abiertos no está disponible")
        
        contests = await scraper.scrape_contests()
        
        return {
            "message": "Scraping de Datos Abiertos Argentina finalizado",
            "total_datasets": len(contests),
            "scraped_at": datetime.now().isoformat(),
            "source": "datos_abiertos_argentina",
            "search_terms": scraper.search_terms,
            "datasets": contests[:10]  # Primeros 10 como ejemplo
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run-puntos-digitales")
async def run_puntos_digitales_scraping():
    """Ejecutar scraping de API de Puntos Digitales"""
    try:
        from app.infrastructure.scrapers.scraper_factory import ScraperFactory
        factory = ScraperFactory()
        scraper = factory.create_scraper("puntos_digitales")
        
        if not await scraper.is_available():
            raise HTTPException(status_code=503, detail="API de Puntos Digitales no está disponible")
        
        contests = await scraper.scrape_contests()
        
        return {
            "message": "Scraping de Puntos Digitales finalizado",
            "total_capacitaciones": len(contests),
            "scraped_at": datetime.now().isoformat(),
            "source": "puntos_digitales",
            "api_url": scraper.api_url,
            "capacitaciones": contests[:10]  # Primeros 10 como ejemplo
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run-cge-simple")
async def run_cge_simple_scraping():
    """Ejecutar scraping simplificado de CGE Entre Ríos (departamentos y niveles limitados)"""
    try:
        from app.infrastructure.scrapers.scraper_factory import ScraperFactory
        factory = ScraperFactory()
        scraper = factory.create_scraper("cge_simple")
        
        if not await scraper.is_available():
            raise HTTPException(status_code=503, detail="CGE Entre Ríos no está disponible")
        
        contests = await scraper.scrape_contests()
        
        return {
            "message": "Scraping simplificado de CGE Entre Ríos finalizado",
            "total_contests": len(contests),
            "scraped_at": datetime.now().isoformat(),
            "source": "cge_simple",
            "test_departments": scraper.departamentos[:3],
            "test_levels": scraper.niveles[:2],
            "contests": contests[:10]  # Primeros 10 como ejemplo
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run-cge-completo")
async def run_cge_completo_scraping():
    """Ejecutar scraping completo de CGE Entre Ríos (todos los departamentos y niveles)"""
    try:
        from app.infrastructure.scrapers.scraper_factory import ScraperFactory
        factory = ScraperFactory()
        scraper = factory.create_scraper("cge_enterios_completo")
        
        if not await scraper.is_available():
            raise HTTPException(status_code=503, detail="CGE Entre Ríos no está disponible")
        
        contests = await scraper.scrape_contests()
        
        return {
            "message": "Scraping completo de CGE Entre Ríos finalizado",
            "total_contests": len(contests),
            "scraped_at": datetime.now().isoformat(),
            "source": "cge_enterios_completo",
            "departments_processed": scraper.departamentos,
            "levels_processed": scraper.niveles,
            "contests": contests[:10]  # Primeros 10 como ejemplo
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run")
async def run_manual_scraping(
    source_name: Optional[str] = Query(None, description="Specific source to scrape (optional)"),
    db: Session = Depends(get_db)
):
    """Run manual scraping for specific source or all sources"""
    scheduler = get_scheduler()
    
    try:
        result = await scheduler.run_manual_scraping(source_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_scraping_status():
    """Get current scraping scheduler status"""
    scheduler = get_scheduler()
    return scheduler.get_scheduler_status()


@router.get("/logs")
async def get_scraping_logs(limit: int = Query(50, ge=1, le=1000)):
    """Get recent scraping logs"""
    scheduler = get_scheduler()
    return {"logs": scheduler.get_recent_logs(limit)}


@router.post("/start")
async def start_scheduler():
    """Start the scraping scheduler"""
    from app.application.services.scheduler_service import scheduler as global_scheduler
    
    if global_scheduler._is_running:
        return {"message": "Scheduler is already running"}
    
    import asyncio
    asyncio.create_task(global_scheduler.start_scheduler())
    
    return {"message": "Scheduler started successfully"}


@router.post("/stop")
async def stop_scheduler():
    """Stop the scraping scheduler"""
    from app.application.services.scheduler_service import scheduler as global_scheduler
    
    global_scheduler.stop_scheduler()
    
    return {"message": "Scheduler stopped successfully"}
