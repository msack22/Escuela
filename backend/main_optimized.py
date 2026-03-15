from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from datetime import datetime
import logging

from app.core.database import engine, SessionLocal, get_db
# Importar solo los routers esenciales para el inicio rápido
from app.api.routes import contests, alerts, users, schools, subjects
# Router de control de scheduler (cargado desde el inicio)
from app.api.routes import scheduler_control
# Los otros routers se importarán bajo demanda
# from app.api.routes import scraping, logs, capacitaciones, diplomas, diploma_scraping, scraping_modern, scraping_async, resolutions
from app.infrastructure.scrapers.scraper_factory import ScrapingService
from app.application.services.scheduler_service import ScrapingScheduler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
from app.domain.models.models import Base
from app.domain.models.resolution_models import Base as ResolutionBase
from app.domain.models.user_models import Base as UserBase

# Crear tablas de ambos modelos
Base.metadata.create_all(bind=engine)
ResolutionBase.metadata.create_all(bind=engine)
UserBase.metadata.create_all(bind=engine)

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

# Include solo los routers esenciales al inicio
app.include_router(contests.router, prefix="/api/contests", tags=["contests"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(schools.router, prefix="/api/schools", tags=["schools"])
app.include_router(subjects.router, prefix="/api/subjects", tags=["subjects"])
# Incluir router de control de scheduler
app.include_router(scheduler_control.router, prefix="/api/scheduler", tags=["scheduler"])

# Función para cargar routers pesados bajo demanda
def load_heavy_routers():
    """Carga los routers pesados solo cuando se necesitan"""
    try:
        from app.api.routes import scraping, logs, capacitaciones, diplomas, diploma_scraping, scraping_modern, scraping_async, resolutions
        
        app.include_router(scraping.router, prefix="/api/scraping", tags=["scraping"])
        app.include_router(scraping_modern.router, tags=["scraping-modern"])
        app.include_router(scraping_async.router, tags=["scraping-async"])
        app.include_router(resolutions.router, tags=["resolutions"])
        app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
        app.include_router(capacitaciones.router, prefix="/api/capacitaciones", tags=["capacitaciones"])
        app.include_router(diplomas.router, prefix="/api/diplomas", tags=["diplomas"])
        app.include_router(diploma_scraping.router, prefix="/api/diploma-scraping", tags=["diploma-scraping"])
        
        logger.info("Heavy routers loaded successfully")
        return True
    except Exception as e:
        logger.error(f"Error loading heavy routers: {e}")
        return False

@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup"""
    logger.info("Starting Sistema de Concursos Educativos API - Optimized Version...")
    
    # Initialize scraping service (sin inicializar para evitar lentitud)
    # scraping_service = ScrapingService()
    # await scraping_service.initialize()  # Comentado temporalmente
    
    # Start scheduler (completamente desactivado para evitar lentitud)
    # scheduler = ScrapingScheduler()
    # await scheduler.start()  # Comentado temporalmente
    
    logger.info("Application started successfully - Scheduler disabled - Heavy routers on demand")


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
        "message": "Sistema de Concursos Educativos API - Optimized Version",
        "version": "1.0.0",
        "endpoints": {
            "contests": "/api/contests",
            "alerts": "/api/alerts", 
            "users": "/api/users",
            "schools": "/api/schools",
            "subjects": "/api/subjects"
        },
        "documentation": "/docs"
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
            "next_run": None,
            "control_available": True,  # Indica que el control manual está disponible
            "control_endpoint": "/api/scheduler"
        },
        "database": "connected",
        "heavy_routers_loaded": False,
        "scheduler_control": {
            "start": "POST /api/scheduler/start",
            "stop": "POST /api/scheduler/stop", 
            "status": "GET /api/scheduler/status",
            "run_once": "POST /api/scheduler/run-once",
            "restart": "POST /api/scheduler/restart"
        }
    }


@app.get("/load-heavy-routers")
async def load_heavy_routers_endpoint():
    """Endpoint para cargar los routers pesados bajo demanda"""
    success = load_heavy_routers()
    return {
        "message": "Heavy routers loading initiated" if not success else "Heavy routers loaded successfully",
        "success": success
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False  # Desactivado para evitar problemas
    )
