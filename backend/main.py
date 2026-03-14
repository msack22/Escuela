from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from datetime import datetime
import logging

from app.core.database import engine, SessionLocal, get_db
from app.api.routes import contests, alerts, scraping, schools, subjects, logs, capacitaciones, diplomas, diploma_scraping
from app.infrastructure.scrapers.scraper_factory import ScrapingService
from app.application.services.scheduler_service import ScrapingScheduler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
from app.domain.models.models import Base
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="Sistema de Concursos Educativos API",
    description="API para gestión de concursos educativos con scraping automático y alertas WhatsApp",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4000", "http://127.0.0.1:3000", "http://127.0.0.1:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(contests.router, prefix="/api/contests", tags=["contests"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(scraping.router, prefix="/api/scraping", tags=["scraping"])
app.include_router(schools.router, prefix="/api/schools", tags=["schools"])
app.include_router(subjects.router, prefix="/api/subjects", tags=["subjects"])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
app.include_router(capacitaciones.router, prefix="/api/capacitaciones", tags=["capacitaciones"])
app.include_router(diplomas.router, prefix="/api/diplomas", tags=["diplomas"])
app.include_router(diploma_scraping.router, prefix="/api/diploma-scraping", tags=["diploma-scraping"])


@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup"""
    logger.info("Starting Sistema de Concursos Educativos API...")
    
    # Initialize scraping service
    scraping_service = ScrapingService()
    # await scraping_service.initialize()  # Comentado temporalmente
    
    # Start scheduler
    # scheduler = ScrapingScheduler()
    # await scheduler.start()  # Comentado temporalmente
    
    logger.info("Application started successfully")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    logger.info("Shutting down Sistema de Concursos Educativos API...")
    
    # Stop scheduler
    scheduler = ScrapingScheduler()
    await scheduler.stop()
    
    logger.info("Application shutdown complete")


@app.get("/")
async def root():
    return {
        "message": "Sistema de Concursos Educativos API",
        "version": "1.0.0",
        "endpoints": {
            "contests": "/api/contests",
            "alerts": "/api/alerts", 
            "scraping": "/api/scraping",
            "schools": "/api/schools",
            "subjects": "/api/subjects"
        },
        "documentation": "/docs"
    }


@app.get("/api/status")
async def system_status():
    """Get system status"""
    return {
        "status": "running",
        "api_status": "healthy",
        "database": "connected",
        "scheduler": "active",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/status")
async def status():
    """Get system status"""
    try:
        scraping_service = ScrapingService()
        scheduler = ScrapingScheduler()
        
        return {
            "status": "running",
            "scraping": {
                "is_running": scheduler.is_running(),
                "last_run": scheduler.get_last_run_time(),
                "next_run": scheduler.get_next_run_time(),
                "available_sources": scraping_service.get_available_sources()
            },
            "database": "connected",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting status: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }


@app.get("/api/status")
async def get_system_status():
    """Get system status including scheduler"""
    from app.application.services.scheduler_service import get_scheduler
    
    scheduler = get_scheduler()
    return {
        "api_status": "running",
        "scheduler": scheduler.get_scheduler_status(),
        "database": "connected"
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=True
    )
