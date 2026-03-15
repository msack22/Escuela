from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging
import sys
from pathlib import Path

# Add src directory to Python path
src_path = Path(__file__).parent
sys.path.insert(0, str(src_path))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Sistema de Concursos Educativos API - Clean Architecture",
    description="API para gestión de concursos educativos con Clean Architecture",
    version="2.0.0"
)

# Add CORS middleware - Deshabilitado para desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir cualquier origen
    allow_credentials=True,
    allow_methods=["*"],  # Permitir cualquier método
    allow_headers=["*"],  # Permitir cualquier header
)

# Import and include routers
from presentation.api.v1.contests import router as contests_router

app.include_router(contests_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "message": "Sistema de Concursos Educativos API - Clean Architecture",
        "version": "2.0.0",
        "architecture": "Clean Architecture",
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "endpoints": {
            "contests": "/api/v1/contests",
            "health": "/health",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "architecture": "Clean Architecture",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0"
    }

@app.get("/api/status")
async def system_status():
    """Get system status"""
    return {
        "status": "running",
        "api_status": "healthy",
        "architecture": "Clean Architecture",
        "database": "connected (In-Memory Repository)",
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main_clean:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
