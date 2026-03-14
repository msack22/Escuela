"""
Scraper base con sistema de aprendizaje universal integrado
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import datetime
import aiohttp
import asyncio
from bs4 import BeautifulSoup

from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest, ScrapedDiploma
from app.infrastructure.scrapers.universal_pattern_learning import UniversalPatternLearning


class LearningScraper(BaseScraper):
    """Scraper base con sistema de aprendizaje universal"""
    
    def __init__(self, name: str, base_url: str, patterns_file: str = None):
        super().__init__(name=name, base_url=base_url)
        self.pattern_learning = UniversalPatternLearning(patterns_file or f"{name.lower().replace(' ', '_')}_patterns.json")
        self._initialize_learning_system()
    
    def _initialize_learning_system(self):
        """Inicializar el sistema de aprendizaje con patrones base"""
        # Patrones iniciales comunes para todos los scrapers
        common_patterns = [
            {
                'type': 'convocatoria_general',
                'pattern': r'convocatoria-[^/]+',
                'description': 'Convocatorias de cualquier tipo',
                'examples': [],
                'confidence': 0.7,
                'created_at': datetime.now().isoformat()
            },
            {
                'type': 'concurso_cargo',
                'pattern': r'concurso-cargo-[^/]+',
                'description': 'Concursos para cargos específicos',
                'examples': [],
                'confidence': 0.8,
                'created_at': datetime.now().isoformat()
            },
            {
                'type': 'llamado_concurso',
                'pattern': r'llamado-a-concurso-[^/]+',
                'description': 'Llamados a concurso',
                'examples': [],
                'confidence': 0.7,
                'created_at': datetime.now().isoformat()
            },
            {
                'type': 'diplomatura_curso',
                'pattern': r'(diplomatura|curso|capacitacion)-[^/]+',
                'description': 'Diplomaturas y cursos',
                'examples': [],
                'confidence': 0.8,
                'created_at': datetime.now().isoformat()
            }
        ]
        
        # Inicializar si no hay patrones
        if not self.pattern_learning.get_patterns_for_scraper(self.name):
            for pattern in common_patterns:
                self.pattern_learning.patterns_data[self.name] = {
                    'learned_patterns': [pattern],
                    'last_updated': datetime.now().isoformat(),
                    'total_urls_learned': 0
                }
            
            self.pattern_learning._save_patterns()
            print(f"🧠 {self.name}: Patrones base inicializados")
    
    @abstractmethod
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """Método abstracto para scraping de concursos"""
        pass
    
    @abstractmethod
    async def scrape_diplomas(self, limit: Optional[int] = None) -> List[ScrapedDiploma]:
        """Método abstracto para scraping de diplomaturas"""
        pass
    
    def learn_from_found_urls(self, urls: List[str], titles: List[str] = None):
        """Aprender de las URLs encontradas durante el scraping"""
        if titles is None:
            titles = [""] * len(urls)
        
        for i, url in enumerate(urls):
            if i < len(titles):
                self.pattern_learning.learn_from_url(self.name, url, titles[i])
    
    def search_patterns_in_content(self, content: str) -> List[Dict]:
        """Buscar patrones aprendidos en contenido"""
        return self.pattern_learning.search_patterns_in_text(self.name, content)
    
    def update_pattern_success(self, pattern_type: str, success: bool):
        """Actualizar confianza de patrones basado en éxito"""
        self.pattern_learning.update_pattern_confidence(self.name, pattern_type, success)
    
    def get_learning_statistics(self) -> Dict:
        """Obtener estadísticas de aprendizaje"""
        return self.pattern_learning.get_statistics()
    
    async def smart_scrape(self, urls_to_explore: List[str], limit: Optional[int] = None) -> List[ScrapedContest]:
        """Scraping inteligente usando patrones aprendidos"""
        contests = []
        headers = self._get_headers()
        
        async with aiohttp.ClientSession(headers=headers) as session:
            for i, url in enumerate(urls_to_explore):
                if limit and len(contests) >= limit:
                    break
                
                try:
                    print(f"🔍 {self.name}: Explorando {i+1}/{len(urls_to_explore)} - {url}")
                    
                    async with session.get(url, timeout=30) as response:
                        if response.status == 200:
                            content = await response.text()
                            soup = BeautifulSoup(content, 'html.parser')
                            
                            # Buscar concursos en esta página
                            page_contests = self._extract_contests_from_page(soup, url)
                            contests.extend(page_contests)
                            
                            # Aprender de esta página
                            self.learn_from_found_urls([url], [self._get_page_title(soup)])
                            
                            # Buscar más URLs usando patrones
                            more_urls = self._find_urls_with_patterns(soup, url)
                            if more_urls:
                                print(f"🎯 {self.name}: Encontradas {len(more_urls)} URLs adicionales por patrones")
                                urls_to_explore.extend(more_urls)
                            
                            print(f"✅ {self.name}: {len(page_contests)} concursos en {url}")
                        else:
                            print(f"❌ {self.name}: Error {response.status} en {url}")
                            
                except Exception as e:
                    print(f"❌ {self.name}: Error en {url}: {e}")
        
        return contests
    
    def _find_urls_with_patterns(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Encontrar URLs usando patrones aprendidos"""
        urls = []
        all_links = soup.find_all('a', href=True)
        
        for link in all_links:
            href = link.get('href', '')
            
            # Buscar coincidencias con patrones aprendidos
            matches = self.search_patterns_in_content(href)
            if matches:
                best_match = max(matches, key=lambda x: x['confidence'])
                if best_match['confidence'] > 0.6:  # Umbral de confianza
                    full_url = self._resolve_url(href, base_url)
                    if full_url not in urls:
                        urls.append(full_url)
                        pattern_type = best_match['pattern']['type']
                        print(f"🎯 {self.name}: URL por patrón {pattern_type}: {full_url}")
        
        return urls
    
    def _get_headers(self) -> Dict[str, str]:
        """Obtener headers para HTTP requests"""
        return {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
    
    def _resolve_url(self, href: str, base_url: str) -> str:
        """Resolver URL relativa a absoluta"""
        if href.startswith('http'):
            return href
        elif href.startswith('/'):
            return base_url.rstrip('/') + href
        else:
            return base_url.rstrip('/') + '/' + href
    
    def _get_page_title(self, soup: BeautifulSoup) -> str:
        """Extraer título de la página"""
        title_tag = soup.find('title')
        if title_tag:
            return title_tag.get_text().strip()
        
        # Buscar en h1, h2
        for tag in ['h1', 'h2', 'h3']:
            header = soup.find(tag)
            if header:
                return header.get_text().strip()
        
        return ""
    
    @abstractmethod
    def _extract_contests_from_page(self, soup: BeautifulSoup, url: str) -> List[ScrapedContest]:
        """Método abstracto para extraer concursos de una página"""
        pass
