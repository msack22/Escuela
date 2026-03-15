"""
Scraper moderno usando Scrapling para reemplazar BeautifulSoup
Ultra-rápido y con soporte JavaScript automático
"""

import asyncio
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from urllib.parse import urljoin

from scrapling import Fetcher
from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest
from app.core.logging_config import LoggerMixin

class ModernScraplingScraper(BaseScraper, LoggerMixin):
    """Scraper ultra-moderno usando Scrapling"""
    
    def __init__(self):
        super().__init__(
            name="Modern Scrapling Scraper",
            base_url="https://www.argentina.gob.ar/educacion"
        )
        
        # Configuración optimizada de Scrapling
        self.fetcher = Fetcher(
            headless=True,
            browser_type="chromium",
            timeout=30000,
            stealthy=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
    
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """Scrape contests usando Scrapling ultra-rápido"""
        from app.core.logging_config import performance_logger
        
        start_time = datetime.now()
        contests = []
        
        self.log_info("Iniciando scraping con Scrapling", source=self.name, limit=limit)
        
        try:
            # Ejecutar scraping con Scrapling
            result = await self.fetcher.fetch(self.base_url)
            
            if not result.success:
                self.log_error("Error en scraping con Scrapling", error=result.error)
                return contests
            
            # Extraer datos usando selectores CSS modernos
            extracted_data = self._extract_contest_data(result.html)
            
            # Convertir a ScrapedContest
            for item in extracted_data[:limit] if limit else extracted_data:
                contest = ScrapedContest(
                    title=item.get('title', ''),
                    description=item.get('description', ''),
                    institution=item.get('institution', 'Ministerio de Educación'),
                    location=item.get('location', 'Argentina'),
                    deadline=item.get('deadline'),
                    requirements=item.get('requirements', []),
                    salary=item.get('salary'),
                    level=item.get('level'),
                    subject=item.get('subject'),
                    source_url=item.get('source_url', self.base_url),
                    source_name=self.name,
                    scraped_at=datetime.now()
                )
                contests.append(contest)
            
            # Log de rendimiento
            duration = (datetime.now() - start_time).total_seconds()
            performance_logger.log_scraping_operation(
                source=self.name,
                contests_found=len(contests),
                duration=duration
            )
            
            self.log_info(
                "Scraping completado con éxito",
                source=self.name,
                total=len(contests),
                duration=duration
            )
            
        except Exception as e:
            self.log_error("Error en scraping", error=str(e), source=self.name)
        
        return contests
    
    def _extract_contest_data(self, html: str) -> List[Dict[str, Any]]:
        """
        Extraer datos del contenido HTML usando selectores CSS
        Scrapling proporciona métodos optimizados para extracción
        """
        # Temporarily disabled - return empty list until we fix Selector issue
        # TODO: Implement proper extraction using beautifulsoup or alternative
        return []
    
    async def is_available(self) -> bool:
        """Verificar si el scraper está disponible"""
        try:
            # Probar conexión básica
            result = await self.fetcher.fetch("https://example.com")
            return result.success
        except:
            return False
    
    async def test_scraping(self) -> Dict[str, Any]:
        """Método de prueba para verificar funcionamiento"""
        self.log_info("Iniciando prueba de Scrapling")
        
        try:
            # Probar scraping básico
            result = await self.fetcher.fetch("https://example.com")
            
            return {
                'success': result.success,
                'content_length': len(result.html) if result.html else 0,
                'execution_time': getattr(result, 'time', 0),
                'error': result.error if not result.success else None
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'content_length': 0,
                'execution_time': 0
            }
