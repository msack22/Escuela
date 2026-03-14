from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.application.services.scheduler_service import get_scheduler
from app.application.services.diploma_processing_service import DiplomaProcessingService

router = APIRouter()


@router.post("/run")
async def run_diploma_scraping(
    source_name: Optional[str] = Query(None, description="Specific source to scrape for diplomas"),
    db: Session = Depends(get_db)
):
    """Run manual scraping for diplomas from specific source or all sources"""
    try:
        from app.infrastructure.scrapers.scraper_factory import ScrapingService
        scraping_service = ScrapingService()
        
        results = {
            "started_at": datetime.now().isoformat(),
            "sources": [],
            "total_diplomas_found": 0,
            "total_diplomas_processed": 0
        }
        
        if source_name:
            # Scrape specific source
            scraper = scraping_service.factory.create_scraper(source_name)
            if not scraper:
                raise ValueError(f"Scraper '{source_name}' not found")
            
            source_result = {
                "name": source_name,
                "status": "success",
                "diplomas_found": 0,
                "diplomas_processed": 0,
                "error": None
            }
            
            try:
                # Scrape diplomas
                scraped_diplomas = await scraper.scrape_diplomas()
                diplomas_found = len(scraped_diplomas)
                source_result["diplomas_found"] = diplomas_found
                
                # Process diplomas
                processing_service = DiplomaProcessingService(db)
                processed_diplomas = await processing_service.process_scraped_diplomas(scraped_diplomas)
                diplomas_processed = len(processed_diplomas)
                source_result["diplomas_processed"] = diplomas_processed
                
                results["total_diplomas_found"] += diplomas_found
                results["total_diplomas_processed"] += diplomas_processed
                
            except Exception as e:
                source_result["status"] = "error"
                source_result["error"] = str(e)
            
            results["sources"].append(source_result)
        else:
            # Scrape all sources
            scrapers_dict = scraping_service.factory.get_available_scrapers()
            scrapers = list(scrapers_dict.values())
            
            for scraper in scrapers:
                if not scraper:
                    continue
                    
                source_result = {
                    "name": scraper.name,
                    "status": "success",
                    "diplomas_found": 0,
                    "diplomas_processed": 0,
                    "error": None
                }
                
                try:
                    # Scrape diplomas
                    scraped_diplomas = await scraper.scrape_diplomas()
                    diplomas_found = len(scraped_diplomas)
                    source_result["diplomas_found"] = diplomas_found
                    
                    # Process diplomas
                    processing_service = DiplomaProcessingService(db)
                    processed_diplomas = await processing_service.process_scraped_diplomas(scraped_diplomas)
                    diplomas_processed = len(processed_diplomas)
                    source_result["diplomas_processed"] = diplomas_processed
                    
                    results["total_diplomas_found"] += diplomas_found
                    results["total_diplomas_processed"] += diplomas_processed
                    
                except Exception as e:
                    source_result["status"] = "error"
                    source_result["error"] = str(e)
                
                results["sources"].append(source_result)
        
        results["finished_at"] = datetime.now().isoformat()
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
