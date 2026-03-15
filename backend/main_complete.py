from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Sistema de Concursos Educativos API",
    description="API para gestión de concursos educativos con scraping automático y alertas WhatsApp",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:4000", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock data for development
MOCK_CONTESTS = [
    {
        "id": 1,
        "title": "Concurso Docente 2024",
        "description": "Concurso para cargos docentes en escuelas primarias",
        "deadline": "2024-12-31",
        "status": "active",
        "requirements": ["Título docente", "Experiencia mínima 2 años"],
        "location": "Buenos Aires",
        "salary": "$50,000"
    },
    {
        "id": 2,
        "title": "Concurso Administrativo",
        "description": "Concurso para puestos administrativos educativos",
        "deadline": "2024-11-30",
        "status": "active",
        "requirements": ["Secundario completo", "Conocimientos de Office"],
        "location": "Córdoba",
        "salary": "$40,000"
    }
]

MOCK_SCHOOLS = [
    {
        "id": 1,
        "name": "Escuela Primaria N°1",
        "address": "Av. Principal 123",
        "city": "Buenos Aires",
        "province": "Buenos Aires",
        "phone": "11-1234-5678",
        "email": "escuela1@edu.gov.ar"
    },
    {
        "id": 2,
        "name": "Escuela Secundaria N°5",
        "address": "Calle Secundaria 456",
        "city": "Córdoba",
        "province": "Córdoba",
        "phone": "351-8765-4321",
        "email": "escuela5@edu.gov.ar"
    }
]

@app.get("/")
async def root():
    return {
        "message": "Sistema de Concursos Educativos API",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "endpoints": {
            "contests": "/api/contests",
            "schools": "/api/schools",
            "health": "/health",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

@app.get("/api/status")
async def system_status():
    """Get system status"""
    return {
        "status": "running",
        "api_status": "healthy",
        "database": "connected (SQLite)",
        "timestamp": datetime.now().isoformat()
    }

# Contests endpoints
@app.get("/api/contests")
async def get_contests():
    """Get all contests"""
    return {
        "contests": MOCK_CONTESTS,
        "total": len(MOCK_CONTESTS),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/contests/{contest_id}")
async def get_contest(contest_id: int):
    """Get contest by ID"""
    contest = next((c for c in MOCK_CONTESTS if c["id"] == contest_id), None)
    if not contest:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Contest not found")
    return contest

@app.post("/api/contests")
async def create_contest(contest_data: dict):
    """Create new contest"""
    new_contest = {
        "id": len(MOCK_CONTESTS) + 1,
        **contest_data,
        "created_at": datetime.now().isoformat()
    }
    MOCK_CONTESTS.append(new_contest)
    return new_contest

# Schools endpoints
@app.get("/api/schools")
async def get_schools():
    """Get all schools"""
    return {
        "schools": MOCK_SCHOOLS,
        "total": len(MOCK_SCHOOLS),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/schools/{school_id}")
async def get_school(school_id: int):
    """Get school by ID"""
    school = next((s for s in MOCK_SCHOOLS if s["id"] == school_id), None)
    if not school:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="School not found")
    return school

# Mock alerts endpoint
@app.get("/api/alerts")
async def get_alerts():
    """Get all alerts"""
    return {
        "alerts": [],
        "total": 0,
        "timestamp": datetime.now().isoformat()
    }

# Capacitaciones endpoints
@app.get("/api/capacitaciones/capacitaciones")
async def get_capacitaciones():
    """Get all capacitaciones"""
    return {
        "capacitaciones": [],
        "total": 0,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/capacitaciones/capacitaciones/scrape")
async def scrape_capacitaciones():
    """Trigger capacitaciones scraping"""
    return {
        "message": "Scraping iniciado",
        "status": "started",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/capacitaciones/capacitaciones/statistics")
async def get_capacitaciones_statistics():
    """Get capacitaciones statistics"""
    return {
        "total": 0,
        "activas": 0,
        "por_modalidad": {},
        "por_nivel": {},
        "timestamp": datetime.now().isoformat()
    }

# Mock scraping endpoint
@app.get("/api/scraping/status")
async def get_scraping_status():
    """Get scraping status"""
    return {
        "status": "inactive",
        "last_run": None,
        "next_run": None,
        "sources": []
    }

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main_complete:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
