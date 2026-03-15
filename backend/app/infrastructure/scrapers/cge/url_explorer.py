"""
Módulo de exploración de URLs para el scraper CGE
Responsable de explorar URLs específicas y extraer concursos
"""

import asyncio
import aiohttp
import logging
from typing import List
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from ..base_scraper import ScrapedContest
from .contest_parser import ContestParser
from .link_extractor import LinkExtractor

logger = logging.getLogger(__name__)


class URLExplorer:
    """Explorador de URLs para el scraper CGE"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.contest_parser = ContestParser()
        self.link_extractor = LinkExtractor(base_url)
        
    async def explore_urls(self, urls: List[str]) -> List[ScrapedContest]:
        """
        Explorar una lista de URLs y extraer concursos
        Implementa múltiples estrategias para maximizar la extracción
        """
        all_contests = []
        
        # Headers para evitar bloqueos
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        async with aiohttp.ClientSession(headers=headers, timeout=aiohttp.ClientTimeout(total=60)) as session:
            # Explorar URLs en paralelo
            tasks = []
            for url in urls:
                task = self._explore_single_url(session, url)
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Procesar resultados
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"❌ Error en URL {urls[i]}: {result}")
                elif result:
                    all_contests.extend(result)
                    logger.info(f"✅ URL {urls[i]} encontró {len(result)} concursos")
        
        logger.info(f"🔍 Exploración completada: {len(all_contests)} concursos totales")
        return all_contests
    
    async def _explore_single_url(self, session: aiohttp.ClientSession, url: str) -> List[ScrapedContest]:
        """
        Explorar una URL específica usando múltiples estrategias
        """
        contests = []
        
        try:
            logger.info(f"🔍 Explorando URL: {url}")
            
            # Si la URL tiene hash, removerlo para la petición HTTP
            clean_url = url.split('#')[0] if '#' in url else url
            
            async with session.get(clean_url) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Estrategia 1: Extraer concursos directamente de la página
                    page_contests = self.contest_parser.parse_contests_from_page(soup, clean_url)
                    contests.extend(page_contests)
                    
                    # Estrategia 2: Buscar enlaces específicos de concursos
                    contest_links = self.link_extractor.extract_contest_links(soup, clean_url)
                    
                    # Estrategia 3: Extraer concursos de los enlaces encontrados (limitado)
                    for link in contest_links[:10]:  # Limitar a 10 enlaces para no sobrecargar
                        try:
                            async with session.get(link) as link_response:
                                if link_response.status == 200:
                                    link_html = await link_response.text()
                                    link_soup = BeautifulSoup(link_html, 'html.parser')
                                    link_contests = self.contest_parser.parse_contests_from_page(link_soup, link)
                                    contests.extend(link_contests)
                                    logger.info(f"✅ Enlace procesado: {link} - {len(link_contests)} concursos")
                        except Exception as e:
                            logger.error(f"❌ Error procesando enlace {link}: {e}")
                            continue
                    
                    logger.info(f"✅ {len(contests)} concursos encontrados en {url}")
                    
                else:
                    logger.warning(f"⚠️ HTTP {response.status} para {url}")
        
        except Exception as e:
            logger.error(f"❌ Error explorando {url}: {e}")
        
        return contests
    
    async def explore_departamental_pages(self) -> List[ScrapedContest]:
        """
        Explorar páginas departamentales del CGE
        Enfocado en los niveles secundario, superior y supervisor
        """
        departamental_urls = [
            # Gualeguaychú
            "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-secundario",
            "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-superior", 
            "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-supervisor",
            
            # Federación
            "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-secundario",
            "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-superior",
            "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-supervisor",
            
            # Otros departamentos con concursos
            "https://cge.entrerios.gov.ar/departamental-diamante/",
            "https://cge.entrerios.gov.ar/departamental-concordia/",
            "https://cge.entrerios.gov.ar/departamental-parana/",
            "https://cge.entrerios.gov.ar/departamental-uruguay/",
            "https://cge.entrerios.gov.ar/departamental-villaguay/",
            "https://cge.entrerios.gov.ar/departamental-colón/",
            "https://cge.entrerios.gov.ar/departamental-federal/",
            "https://cge.entrerios.gov.ar/departamental-concepción-del-uruguay/"
        ]
        
        logger.info("🏫 Explorando páginas departamentales...")
        return await self.explore_urls(departamental_urls)
    
    async def explore_main_sections(self) -> List[ScrapedContest]:
        """
        Explorar secciones principales del sitio CGE
        """
        main_urls = [
            "https://cge.entrerios.gov.ar/concursos/",
            "https://cge.entrerios.gov.ar/noticias/",
            "https://cge.entrerios.gov.ar/jurado-de-concursos-noticias/",
            "https://cge.entrerios.gov.ar/2026/03/",
            "https://cge.entrerios.gov.ar/2026/02/",
            "https://cge.entrerios.gov.ar/2026/01/"
        ]
        
        logger.info("📰 Explorando secciones principales...")
        return await self.explore_urls(main_urls)
