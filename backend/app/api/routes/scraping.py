from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.application.services.scheduler_service import get_scheduler

router = APIRouter()


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
