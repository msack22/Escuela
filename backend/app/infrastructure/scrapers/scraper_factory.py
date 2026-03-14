import aiohttp
import asyncio
from typing import Dict, List
from app.infrastructure.scrapers.base_scraper import BaseScraper
from app.infrastructure.scrapers.educacion_gob_scraper import EducacionGobScraper
from app.infrastructure.scrapers.enterios_scraper import EntreriosScraper
from app.infrastructure.scrapers.facebook_scraper import FacebookScraper


class ScraperFactory:
    """Factory class for creating scrapers following Factory Pattern"""
    
    @staticmethod
    def create_scraper(source_name: str) -> BaseScraper:
        """Create appropriate scraper instance based on source name"""
        scrapers = {
            "educacion_gob": EducacionGobScraper(),
            "consejo_entrerios": EntreriosScraper(),
            "facebook": FacebookScraper(),
        }
        
        if source_name in scrapers:
            return scrapers[source_name]
        
        raise ValueError(f"Unknown scraper source: {source_name}")
    
    @staticmethod
    def get_available_scrapers() -> Dict[str, BaseScraper]:
        """Get all available scrapers"""
        return {
            "educacion_gob": EducacionGobScraper(),
            "consejo_entrerios": EntreriosScraper(),
            "facebook": FacebookScraper(),
        }
    
    @staticmethod
    def get_scraper_names() -> List[str]:
        """Get list of available scraper names"""
        return ["educacion_gob", "consejo_entrerios", "facebook"]


class ScrapingService:
    """Service for managing scraping operations following Singleton Pattern"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.factory = ScraperFactory()
            self._register_default_scrapers()
            self.initialized = True
    
    def _register_default_scrapers(self):
        """Register default scrapers"""
        from app.infrastructure.scrapers.educacion_gob_scraper import EducacionGobScraper
        
        self.factory.register_scraper("educacion_gob", EducacionGobScraper())
        
        # Add more scrapers here as they are created
        # self.factory.register_scraper("portal_educacion", PortalEducacionScraper())
        # self.factory.register_scraper("consejo_educacion", ConsejoEducacionScraper())
    
    async def scrape_all_sources(self) -> List[ScrapedContest]:
        """Scrape contests from all available sources"""
        all_contests = []
        available_scrapers = self.factory.get_available_scrapers()
        
        # Run scrapers concurrently
        tasks = []
        for scraper in available_scrapers:
            task = asyncio.create_task(
                self._scrape_source_with_error_handling(scraper)
            )
            tasks.append(task)
        
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, list):
                    all_contests.extend(result)
                elif isinstance(result, Exception):
                    print(f"Scraping error: {result}")
        
        return all_contests
    
    async def _scrape_source_with_error_handling(self, scraper: BaseScraper) -> List[ScrapedContest]:
        """Scrape from a single source with error handling"""
        try:
            print(f"Scraping from {scraper.name}...")
            contests = await scraper.scrape_contests()
            print(f"Found {len(contests)} contests from {scraper.name}")
            return contests
        except Exception as e:
            print(f"Error scraping from {scraper.name}: {e}")
            return []
    
    async def scrape_specific_source(self, source_name: str) -> List[ScrapedContest]:
        """Scrape contests from a specific source"""
        scraper = self.factory.create_scraper(source_name)
        if not scraper:
            raise ValueError(f"Scraper '{source_name}' not found")
        
        return await self._scrape_source_with_error_handling(scraper)
    
    def get_available_sources(self) -> List[str]:
        """Get list of available source names"""
        scrapers = self.factory.get_available_scrapers()
        return [scraper.name for scraper in scrapers]
    
    def get_all_sources(self) -> List[str]:
        """Get list of all registered source names"""
        return list(self.factory._scrapers.keys())
