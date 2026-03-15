from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from datetime import datetime
import logging

from app.core.database import engine, SessionLocal, get_db
from app.api.routes import contests, alerts, scraping, schools, subjects, logs, capacitaciones, diplomas, diploma_scraping, scraping_modern, scraping_async, resolutions, users
from app.infrastructure.scrapers.scraper_factory import ScrapingService
from app.application.services.scheduler_service import ScrapingScheduler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
from app.domain.models.models import Base
from app.domain.models.resolution_models import Base as ResolutionBase

# Crear tablas de ambos modelos
Base.metadata.create_all(bind=engine)
ResolutionBase.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="Sistema de Concursos Educativos API",
    description="API para gestión de concursos educativos con scraping automático y alertas WhatsApp",
    version="1.0.0"
)

# Add CORS middleware - Deshabilitado para desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir cualquier origen
    allow_credentials=True,
    allow_methods=["*"],  # Permitir cualquier método
    allow_headers=["*"],  # Permitir cualquier header
)

# Include API routers
app.include_router(contests.router, prefix="/api/contests", tags=["contests"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(scraping.router, prefix="/api/scraping", tags=["scraping"])
app.include_router(scraping_modern.router, tags=["scraping-modern"])
app.include_router(scraping_async.router, tags=["scraping-async"])
app.include_router(resolutions.router, tags=["resolutions"])
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
    
    # Initialize scraping service (sin inicializar para evitar lentitud)
    # scraping_service = ScrapingService()
    # await scraping_service.initialize()  # Comentado temporalmente
    
    # Start scheduler (completamente desactivado para evitar lentitud)
    # scheduler = ScrapingScheduler()
    # await scheduler.start()  # Comentado temporalmente
    
    logger.info("Application started successfully - Scheduler disabled")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    logger.info("Shutting down Sistema de Concursos Educativos API...")
    
    # Stop scheduler (completamente desactivado)
    # scheduler = ScrapingScheduler()
    # await scheduler.stop()  # Comentado temporalmente
    
    logger.info("Application shutdown complete - Scheduler disabled")


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
        # scraping_service = ScrapingService()  # Comentado para evitar inicialización
        # scheduler = ScrapingScheduler()  # Comentado para evitar inicialización
        
        return {
            "status": "running",
            "scraping": {
                "is_running": False,  # Scheduler desactivado
                "last_run": None,
                "next_run": None,
                "available_sources": []  # Temporalmente vacío
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
    # from app.application.services.scheduler_service import get_scheduler  # Comentado para evitar inicialización
    
    # scheduler = get_scheduler()  # Comentado para evitar inicialización
    return {
        "api_status": "running",
        "scheduler": {
            "is_running": False,
            "last_run": None,
            "next_run": None
        },
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
