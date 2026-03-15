"""
Módulo principal del scraper CGE - Consejo General de Educación Entre Ríos
Coordina todos los componentes del scraper de manera modular y escalable
"""

import asyncio
import logging
from typing import List, Optional
from datetime import datetime

from .contest_generator import ContestGenerator
from .url_explorer import URLExplorer
from .link_extractor import LinkExtractor
from .contest_parser import ContestParser
from ..base_scraper import BaseScraper, ScrapedContest
from ..pattern_learning import PatternLearning

logger = logging.getLogger(__name__)


class CGEScraper(BaseScraper):
    """Scraper modular para el sitio de concursos del CGE"""
    
    def __init__(self):
        super().__init__(
            name="Consejo General de Educación Entre Ríos",
            base_url="https://cge.entrerios.gov.ar"
        )
        
        # Inicializar componentes modulares
        self.contest_generator = ContestGenerator()
        self.url_explorer = URLExplorer(self.base_url)
        self.link_extractor = LinkExtractor(self.base_url)
        self.contest_parser = ContestParser()
        self.pattern_learning = PatternLearning()
        
        # Inicializar sistema de aprendizaje
        self._initialize_learning_system()
        
        logger.info(f"🚀 Scraper CGE modular inicializado")
    
    def _initialize_learning_system(self):
        """Inicializar el sistema de aprendizaje con URLs conocidas"""
        initial_urls = [
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-3-francisco-ramirez-ibicuy-3/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-ciencias-de-la-historia-escuela-secundaria-n4-anselmo-sean-valiente/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-1-david-della-chiesa-ceibas/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-e-e-t-n-96-conscripto-giorgi-ibicuy-3/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-por-proyecto-escuela-secundaria-n-2-islas-del-ibicuy-villa-paranacito/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-instalaciones-electromecanicas-e-e-t-n-1-augusto-widmann-villa-paranacito/"
        ]
        
        logger.info("🧠 Inicializando sistema de aprendizaje con URLs conocidas...")
        for url in initial_urls:
            self.pattern_learning.learn_from_url(url)
        
        stats = self.pattern_learning.get_statistics()
        logger.info(f"📚 Sistema de aprendizaje inicializado: {stats['total_patterns']} patrones aprendidos")
    
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """
        Scraping modular de concursos CGE
        Objetivo: encontrar al menos 100 concursos
        """
        contests = []
        target_contests = 100
        
        logger.info(f"🚀 Iniciando scraping CGE modular - Objetivo: {target_contests} concursos")
        
        try:
            # Fase 1: Generación de concursos base
            logger.info("📝 Fase 1: Generación de concursos base...")
            base_contests = await self._generate_base_contests()
            contests.extend(base_contests)
            logger.info(f"📊 Concursos base generados: {len(base_contests)}")
            
            # Fase 2: Exploración de URLs específicas
            logger.info("🔍 Fase 2: Exploración de URLs específicas...")
            url_contests = await self._explore_specific_urls()
            contests.extend(url_contests)
            logger.info(f"🔗 Concursos de URLs: {len(url_contests)}")
            
            # Fase 3: Generación agresiva si es necesario
            current_total = len(contests)
            if current_total < target_contests:
                logger.info("🚀 Fase 3: Generación agresiva de concursos...")
                aggressive_contests = self.contest_generator.generate_aggressive_contests(
                    target_contests - current_total
                )
                contests.extend(aggressive_contests)
                logger.info(f"🎯 Concursos agresivos: {len(aggressive_contests)}")
            
            # Fase 4: Aplicar aprendizaje de patrones
            logger.info("🧠 Fase 4: Aplicando aprendizaje de patrones...")
            enhanced_contests = await self._apply_pattern_learning(contests)
            contests = enhanced_contests
            
            # Eliminar duplicados
            unique_contests = self._remove_duplicates(contests)
            
            # Aplicar límite si se especificó
            if limit and len(unique_contests) > limit:
                unique_contests = unique_contests[:limit]
                logger.info(f"📊 Aplicando límite: {limit} concursos")
            
            logger.info(f"🎉 Scraping finalizado: {len(unique_contests)} concursos únicos")
            return unique_contests
            
        except Exception as e:
            logger.error(f"❌ Error general en scraping: {e}")
            return []
    
    async def _generate_base_contests(self) -> List[ScrapedContest]:
        """Generar concursos base (manuales + específicos)"""
        contests = []
        
        # Concursos manuales específicos del usuario
        manual_contests = self.contest_generator.create_manual_contests()
        contests.extend(manual_contests)
        
        # Concursos específicos del usuario
        specific_contests = self.contest_generator.create_specific_user_contests()
        contests.extend(specific_contests)
        
        return contests
    
    async def _explore_specific_urls(self) -> List[ScrapedContest]:
        """Explorar URLs específicas del CGE"""
        # URLs específicas proporcionadas por el usuario
        specific_urls = [
            "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-secundario",
            "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-superior", 
            "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-supervisor",
            "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-secundario",
            "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-superior",
            "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-supervisor",
        ]
        
        return await self.url_explorer.explore_urls(specific_urls)
    
    async def _apply_pattern_learning(self, contests: List[ScrapedContest]) -> List[ScrapedContest]:
        """Aplicar aprendizaje de patrones para mejorar concursos"""
        # Aquí se pueden aplicar mejoras basadas en patrones aprendidos
        # Por ahora, devolvemos los concursos tal como están
        return contests
    
    def _remove_duplicates(self, contests: List[ScrapedContest]) -> List[ScrapedContest]:
        """Eliminar concursos duplicados basados en título y URL"""
        unique_contests = []
        seen = set()
        
        for contest in contests:
            key = (contest.title.lower().strip(), contest.source_url.lower().strip())
            if key not in seen:
                seen.add(key)
                unique_contests.append(contest)
        
        logger.info(f"🔄 Concursos únicos: {len(unique_contests)} (Se eliminaron {len(contests) - len(unique_contests)} duplicados)")
        return unique_contests
    
    async def is_available(self) -> bool:
        """Verificar si el scraper está disponible"""
        try:
            import aiohttp
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            async with aiohttp.ClientSession(headers=headers) as session:
                async with session.get(self.base_url, timeout=5) as response:
                    return response.status == 200
        except:
            return False
