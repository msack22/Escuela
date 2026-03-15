"""
API endpoint para probar el nuevo scraper con Scrapling
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from app.infrastructure.scrapers.modern_scrapling_scraper import ModernScraplingScraper
from app.core.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix="/scraping-modern", tags=["scraping-modern"])

class ScrapingTestRequest(BaseModel):
    url: Optional[str] = "https://www.argentina.gob.ar/educacion"
    limit: Optional[int] = 10

class ScrapingTestResponse(BaseModel):
    success: bool
    total_contests: int
    contests: List[Dict[str, Any]]
    execution_time: float
    error: Optional[str] = None

@router.get("/test", response_model=Dict[str, Any])
async def test_scraping():
    """Probar el scraper moderno con Scrapling"""
    try:
        scraper = ModernScraplingScraper()
        result = await scraper.test_scraping()
        
        return {
            "status": "success",
            "scraper": "ModernScraplingScraper",
            "technology": "Scrapling",
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scrape", response_model=ScrapingTestResponse)
async def scrape_with_modern(request: ScrapingTestRequest, db: Session = Depends(get_db)):
    """Ejecutar scraping con el scraper moderno"""
    try:
        scraper = ModernScraplingScraper()
        
        # Si se proporciona URL personalizada, actualizarla
        if request.url != scraper.base_url:
            scraper.base_url = request.url
        
        # Ejecutar scraping
        start_time = datetime.now()
        contests = await scraper.scrape_contests(limit=request.limit)
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Convertir a diccionarios para respuesta
        contests_data = []
        for contest in contests:
            contests_data.append({
                "title": contest.title,
                "description": contest.description,
                "institution": contest.institution,
                "location": contest.location,
                "deadline": contest.deadline.isoformat() if contest.deadline else None,
                "requirements": contest.requirements,
                "salary": contest.salary,
                "level": contest.level,
                "subject": contest.subject,
                "source_url": contest.source_url,
                "source_name": contest.source_name,
                "scraped_at": contest.scraped_at.isoformat() if contest.scraped_at else None
            })
        
        return ScrapingTestResponse(
            success=True,
            total_contests=len(contests_data),
            contests=contests_data,
            execution_time=execution_time
        )
        
    except Exception as e:
        return ScrapingTestResponse(
            success=False,
            total_contests=0,
            contests=[],
            execution_time=0,
            error=str(e)
        )

@router.get("/compare")
async def compare_scrapers():
    """Comparar rendimiento entre scrapers"""
    try:
        from app.infrastructure.scrapers.educacion_gob_scraper import EducacionGobScraper
        
        # Probar scraper antiguo
        old_scraper = EducacionGobScraper()
        start_time = datetime.now()
        old_results = await old_scraper.scrape_contests(limit=5)
        old_time = (datetime.now() - start_time).total_seconds()
        
        # Probar scraper nuevo
        new_scraper = ModernScraplingScraper()
        start_time = datetime.now()
        new_results = await new_scraper.scrape_contests(limit=5)
        new_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "comparison": {
                "old_scraper": {
                    "name": "EducacionGobScraper (BeautifulSoup)",
                    "technology": "BeautifulSoup + aiohttp",
                    "contests_found": len(old_results),
                    "execution_time": old_time
                },
                "new_scraper": {
                    "name": "ModernScraplingScraper (Scrapling)",
                    "technology": "Scrapling",
                    "contests_found": len(new_results),
                    "execution_time": new_time
                },
                "improvement": {
                    "speed_improvement": f"{((old_time - new_time) / old_time * 100):.1f}%",
                    "faster_by": f"{old_time / new_time:.1f}x"
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Verificar estado del scraper moderno"""
    return {
        "status": "healthy",
        "scraper": "ModernScraplingScraper",
        "technology": "Scrapling",
        "version": "0.4.2",
        "features": [
            "Ultra-fast scraping",
            "JavaScript support",
            "Automatic bot detection",
            "Memory efficient",
            "Async/await native"
        ]
    }
