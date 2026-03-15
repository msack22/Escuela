"""
Scraper moderno usando Scrapling para reemplazar BeautifulSoup
Ultra-rápido y con soporte JavaScript automático
"""

import asyncio
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from urllib.parse import urljoin

from scrapling import Fetcher, Selector
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
        # Crear selector con Scrapling
        selector = Selector(html)
        
        # Definir selectores CSS para diferentes tipos de contenido
        contest_selectors = [
            '.contest-item',
            '.job-item', 
            '.vacante-item',
            'article',
            '.convocatoria-item',
            '.oferta-item'
        ]
        
        contests = []
        
        for contest_selector in contest_selectors:
            items = selector.css(contest_selector)
            
            for item in items:
                # Extraer campos con selectores específicos
                contest_data = {
                    'title': self._extract_text(item, [
                        '.title h2',
                        '.vacante-titulo', 
                        'h2',
                        'h3',
                        '.titulo'
                    ]),
                    'description': self._extract_text(item, [
                        '.description',
                        '.vacante-descripcion',
                        '.content p',
                        '.descripcion'
                    ]),
                    'institution': self._extract_text(item, [
                        '.institution',
                        '.escuela-nombre',
                        '.organization',
                        '.institucion'
                    ]),
                    'location': self._extract_text(item, [
                        '.location',
                        '.ubicacion',
                        '.localidad',
                        '.lugar'
                    ]),
                    'deadline': self._extract_text(item, [
                        '.deadline',
                        '.fecha-limite',
                        '.date',
                        '.fecha'
                    ]),
                    'requirements': self._extract_list(item, [
                        '.requirements li',
                        '.requisitos li',
                        '.requirement'
                    ]),
                    'salary': self._extract_text(item, [
                        '.salary',
                        '.salario',
                        '.remuneracion',
                        '.sueldo'
                    ]),
                    'level': self._extract_text(item, [
                        '.level',
                        '.nivel',
                        '.education-level',
                        '.nivel-educativo'
                    ]),
                    'subject': self._extract_text(item, [
                        '.subject',
                        '.materia',
                        '.asignatura',
                        '.area'
                    ]),
                    'link': self._extract_attr(item, [
                        'a::attr(href)',
                        '.ver-mas::attr(href)',
                        'a.link::attr(href)'
                    ])
                }
                
                # Agregar URL base si es relativa
                if contest_data['link']:
                    contest_data['source_url'] = self._resolve_url(contest_data['link'], self.base_url)
                else:
                    contest_data['source_url'] = self.base_url
                
                # Solo incluir si tiene título
                if contest_data['title']:
                    contests.append(contest_data)
            
            # Si encontramos resultados, no seguir buscando con otros selectores
            if contests:
                break
        
        return contests
    
    def _extract_text(self, element, selectors: List[str]) -> str:
        """Extraer texto de un elemento usando múltiples selectores"""
        for selector in selectors:
            try:
                result = element.css(selector)
                if result:
                    text = result[0].text() if isinstance(result, list) else result.text()
                    return self._clean_text(text)
            except:
                continue
        return ""
    
    def _extract_list(self, element, selectors: List[str]) -> List[str]:
        """Extraer lista de textos de un elemento"""
        for selector in selectors:
            try:
                result = element.css(selector)
                if result:
                    items = result if isinstance(result, list) else [result]
                    return [self._clean_text(item.text()) for item in items if item.text()]
            except:
                continue
        return []
    
    def _extract_attr(self, element, selectors: List[str]) -> str:
        """Extraer atributo de un elemento usando múltiples selectores"""
        for selector in selectors:
            try:
                result = element.css(selector)
                if result:
                    attr_value = result[0].attr() if isinstance(result, list) else result.attr()
                    return attr_value or ""
            except:
                continue
        return ""
    
    def _clean_text(self, text: str) -> str:
        """Limpiar texto extraído"""
        if not text:
            return ""
        
        # Eliminar espacios extra y saltos de línea
        text = ' '.join(text.split())
        
        # Eliminar caracteres no deseados
        import re
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        return text
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parsear fecha con múltiples formatos"""
        if not date_str:
            return None
        
        from datetime import datetime
        import re
        
        # Patrones de fecha comunes
        patterns = [
            r'(\d{2})/(\d{2})/(\d{4})',  # DD/MM/YYYY
            r'(\d{4})-(\d{2})-(\d{2})',  # YYYY-MM-DD
            r'(\d{1,2}) de (\w+) de (\d{4})',  # DD de Mes de YYYY
        ]
        
        for pattern in patterns:
            match = re.search(pattern, date_str)
            if match:
                try:
                    if pattern == patterns[0]:  # DD/MM/YYYY
                        day, month, year = match.groups()
                        return datetime(int(year), int(month), int(day))
                    elif pattern == patterns[1]:  # YYYY-MM-DD
                        year, month, day = match.groups()
                        return datetime(int(year), int(month), int(day))
                    elif pattern == patterns[2]:  # DD de Mes de YYYY
                        day, month_name, year = match.groups()
                        months = {
                            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
                            'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
                            'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
                        }
                        month = months.get(month_name.lower(), 1)
                        return datetime(int(year), month, int(day))
                except ValueError:
                    continue
        
        return None
    
    def _resolve_url(self, url: str, base_url: str) -> str:
        """Resolver URL relativa a absoluta"""
        if not url:
            return base_url
        
        if url.startswith('http'):
            return url
        
        return urljoin(base_url, url)
    
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
