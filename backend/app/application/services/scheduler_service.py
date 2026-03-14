import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager

from app.infrastructure.scrapers.scraper_factory import ScrapingService
from app.application.services.contest_processing_service import ContestProcessingService
from app.application.services.alert_service import AlertService
from app.domain.repositories.repositories import ScrapingLogRepository
from app.domain.models.models import ScrapingLog
from app.core.database import SessionLocal
from app.core.config import settings

logger = logging.getLogger(__name__)


class ScrapingScheduler:
    """Scheduler for automated scraping operations following Singleton Pattern"""
    
    _instance = None
    _is_running = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.scraping_service = ScrapingService()
            self.initialized = True
    
    async def start_scheduler(self):
        """Start the automated scraping scheduler"""
        if self._is_running:
            logger.warning("Scheduler is already running")
            return
        
        self._is_running = True
        logger.info("Starting scraping scheduler...")
        
        while self._is_running:
            try:
                await self.run_scraping_cycle()
                
                # Wait for the configured interval
                await asyncio.sleep(settings.scraping_interval_hours * 3600)
                
            except Exception as e:
                logger.error(f"Error in scraping cycle: {e}")
                # Wait 5 minutes before retrying on error
                await asyncio.sleep(300)
    
    def stop_scheduler(self):
        """Stop the scheduler"""
        self._is_running = False
        logger.info("Scraping scheduler stopped")
    
    async def run_scraping_cycle(self):
        """Run a complete scraping cycle"""
        logger.info("Starting scraping cycle...")
        start_time = datetime.now()
        
        # Get database session
        db = SessionLocal()
        try:
            # Create log entry
            log_repo = ScrapingLogRepository(db)
            
            # Get all scrapers
            scrapers = self.scraping_service.get_all_scrapers()
            
            total_contests_found = 0
            total_contests_processed = 0
            
            for scraper in scrapers:
                scraper_start_time = datetime.now()
                
                try:
                    # Scrape contests
                    scraped_contests = await self.scraping_service.scrape_specific_source(scraper.name)
                    contests_found = len(scraped_contests)
                    
                    # Process contests
                    processing_service = ContestProcessingService(db)
                    processed_contests = await processing_service.process_scraped_contests(scraped_contests)
                    contests_processed = len(processed_contests)
                    
                    # Send notifications for new contests
                    alert_service = AlertService(db)
                    notifications_sent = 0
                    for contest in processed_contests:
                        sent = await alert_service.check_and_send_notifications(contest)
                        notifications_sent += sent
                    
                    # Log success
                    execution_time = (datetime.now() - scraper_start_time).total_seconds()
                    log_entry = ScrapingLog(
                        source_name=scraper.name,
                        status="success",
                        contests_found=contests_found,
                        contests_processed=contests_processed,
                        execution_time_seconds=execution_time,
                        started_at=scraper_start_time,
                        finished_at=datetime.now()
                    )
                    log_repo.create(log_entry)
                    
                    total_contests_found += contests_found
                    total_contests_processed += contests_processed
                    
                    logger.info(f"Scraper '{scraper.name}': {contests_found} found, {contests_processed} processed, {notifications_sent} notifications sent")
                
                except Exception as e:
                    # Log error
                    execution_time = (datetime.now() - scraper_start_time).total_seconds()
                    log_entry = ScrapingLog(
                        source_name=scraper.name,
                        status="error",
                        contests_found=0,
                        contests_processed=0,
                        error_message=str(e),
                        execution_time_seconds=execution_time,
                        started_at=scraper_start_time,
                        finished_at=datetime.now()
                    )
                    log_repo.create(log_entry)
                    
                    logger.error(f"Error in scraper '{scraper.name}': {e}")
            
            # Log overall cycle completion
            total_execution_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"Scraping cycle completed: {total_contests_found} contests found, {total_contests_processed} processed in {total_execution_time:.2f} seconds")
            
        except Exception as e:
            logger.error(f"Error in scraping cycle: {e}")
        finally:
            db.close()
    
    async def run_manual_scraping(self, source_name: str = None) -> Dict[str, Any]:
        """Run manual scraping for specific source or all sources"""
        db = SessionLocal()
        try:
            results = {
                "started_at": datetime.now().isoformat(),
                "sources": [],
                "total_contests_found": 0,
                "total_contests_processed": 0,
                "total_notifications_sent": 0
            }
            
            if source_name:
                # Scrape specific source
                scrapers = [self.scraping_service.factory.create_scraper(source_name)]
                if not scrapers[0]:
                    raise ValueError(f"Scraper '{source_name}' not found")
            else:
                # Scrape all sources
                scrapers = self.scraping_service.get_all_scrapers()
            
            log_repo = ScrapingLogRepository(db)
            
            for scraper in scrapers:
                if not scraper:
                    continue
                    
                scraper_start_time = datetime.now()
                source_result = {
                    "name": scraper.name,
                    "status": "success",
                    "contests_found": 0,
                    "contests_processed": 0,
                    "notifications_sent": 0,
                    "error": None
                }
                
                try:
                    # Scrape contests
                    scraped_contests = await scraper.scrape_contests()
                    contests_found = len(scraped_contests)
                    source_result["contests_found"] = contests_found
                    
                    # Process contests
                    processing_service = ContestProcessingService(db)
                    processed_contests = await processing_service.process_scraped_contests(scraped_contests)
                    contests_processed = len(processed_contests)
                    source_result["contests_processed"] = contests_processed
                    
                    # Send notifications
                    alert_service = AlertService(db)
                    notifications_sent = 0
                    for contest in processed_contests:
                        sent = await alert_service.check_and_send_notifications(contest)
                        notifications_sent += sent
                    source_result["notifications_sent"] = notifications_sent
                    
                    # Update totals
                    results["total_contests_found"] += contests_found
                    results["total_contests_processed"] += contests_processed
                    results["total_notifications_sent"] += notifications_sent
                    
                    # Log success
                    execution_time = (datetime.now() - scraper_start_time).total_seconds()
                    log_entry = ScrapingLog(
                        source_name=scraper.name,
                        status="success",
                        contests_found=contests_found,
                        contests_processed=contests_processed,
                        execution_time_seconds=execution_time,
                        started_at=scraper_start_time,
                        finished_at=datetime.now()
                    )
                    log_repo.create(log_entry)
                    
                except Exception as e:
                    source_result["status"] = "error"
                    source_result["error"] = str(e)
                    
                    # Log error
                    execution_time = (datetime.now() - scraper_start_time).total_seconds()
                    log_entry = ScrapingLog(
                        source_name=scraper.name,
                        status="error",
                        contests_found=0,
                        contests_processed=0,
                        error_message=str(e),
                        execution_time_seconds=execution_time,
                        started_at=scraper_start_time,
                        finished_at=datetime.now()
                    )
                    log_repo.create(log_entry)
                
                results["sources"].append(source_result)
            
            results["finished_at"] = datetime.now().isoformat()
            return results
            
        finally:
            db.close()
    
    def get_scheduler_status(self) -> Dict[str, Any]:
        """Get current scheduler status"""
        return {
            "is_running": self._is_running,
            "interval_hours": settings.scraping_interval_hours,
            "available_sources": self.scraping_service.get_available_sources(),
            "all_sources": self.scraping_service.get_all_sources()
        }
    
    def get_recent_logs(self, limit: int = 50) -> list:
        """Get recent scraping logs"""
        db = SessionLocal()
        try:
            log_repo = ScrapingLogRepository(db)
            logs = log_repo.get_recent_logs(limit)
            
            return [
                {
                    "id": log.id,
                    "source_name": log.source_name,
                    "status": log.status,
                    "contests_found": log.contests_found,
                    "contests_processed": log.contests_processed,
                    "error_message": log.error_message,
                    "execution_time_seconds": log.execution_time_seconds,
                    "started_at": log.started_at.isoformat() if log.started_at else None,
                    "finished_at": log.finished_at.isoformat() if log.finished_at else None
                }
                for log in logs
            ]
        finally:
            db.close()


# Global scheduler instance
scheduler = ScrapingScheduler()


async def start_background_scheduler():
    """Start the background scheduler (to be called on application startup)"""
    # Run scheduler in background
    asyncio.create_task(scheduler.start_scheduler())
    logger.info("Background scheduler started")


def get_scheduler() -> ScrapingScheduler:
    """Get the global scheduler instance"""
    return scheduler
