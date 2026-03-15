"""
Scraper Simplificado para CGE Entre Ríos - Todos los Departamentos y Niveles
"""

import aiohttp
import asyncio
from bs4 import BeautifulSoup
from typing import List, Optional, Dict, Any
from datetime import datetime
import re
from urllib.parse import urljoin, urlparse
import logging

# Configurar logging detallado
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/cge_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest


class SimpleCGEScraper(BaseScraper):
    """Scraper simplificado para el sitio de concursos de Entre Ríos"""
    
    def __init__(self):
        super().__init__("CGE Entre Ríos Simple", "https://cge.entrerios.gov.ar")
        self.session = None
        
        # Departamentos de Entre Ríos (basado en el HTML proporcionado)
        self.departamentos = [
            "colon",
            "concordia", 
            "diamante",
            "federacion",
            "federal",
            "feliciano",
            "gualeguay",
            "gualeguaychu",
            "islas-del-ibicuy",
            "la-paz",
            "nogoya",
            "parana",
            "san-salvador",
            "tala",
            "uruguay",
            "victoria",
            "villaguay"
        ]
        
        # Niveles educativos para cada departamento
        self.niveles = [
            "concursos-nivel-inicial",
            "concursos-nivel-primario", 
            "concursos-nivel-secundario",
            "concursos-nivel-superior",
            "concursos-nivel-supervisor"
        ]
    
    async def is_available(self) -> bool:
        """Verificar si el sitio está disponible"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, timeout=10) as response:
                    return response.status == 200
        except Exception as e:
            logger.error(f"Error verificando disponibilidad: {e}")
            return False
    
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """Extraer concursos de todos los departamentos y niveles"""
        logger.info("Iniciando scraping simplificado de CGE Entre Ríos")
        
        all_contests = []
        
        try:
            # Crear sesión persistente
            timeout = aiohttp.ClientTimeout(total=30)
            connector = aiohttp.TCPConnector(limit=10, limit_per_host=5)
            self.session = aiohttp.ClientSession(timeout=timeout, connector=connector)
            
            # Procesar solo algunos departamentos para prueba
            test_departamentos = self.departamentos[:3]  # Solo los primeros 3
            test_niveles = self.niveles[:2]  # Solo los primeros 2 niveles
            
            for departamento in test_departamentos:
                logger.info(f"Procesando departamento: {departamento}")
                
                for nivel in test_niveles:
                    url = f"{self.base_url}/departamental-{departamento}/#{nivel}"
                    
                    try:
                        contests = await self._scrape_department_level(url, departamento, nivel)
                        all_contests.extend(contests)
                        
                        # Pequeña pausa para no sobrecargar el servidor
                        await asyncio.sleep(0.5)
                        
                    except Exception as e:
                        logger.error(f"Error procesando {departamento} - {nivel}: {e}")
                        continue
            
            logger.info(f"Scraping completado. Total de concursos encontrados: {len(all_contests)}")
            return all_contests
            
        except Exception as e:
            logger.error(f"Error general en scraping: {e}")
            return []
        finally:
            if self.session:
                await self.session.close()
    
    async def _scrape_department_level(self, url: str, departamento: str, nivel: str) -> List[ScrapedContest]:
        """Extraer concursos de un departamento y nivel específico"""
        logger.info(f"Scraping {departamento} - {nivel}: {url}")
        
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    logger.warning(f"Error HTTP {response.status} para {url}")
                    return []
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                contests = []
                
                # Buscar enlaces directos a concursos
                contest_links = self._find_contest_links(soup, url)
                
                for link_info in contest_links:
                    try:
                        contest = await self._scrape_contest_page(link_info['url'], departamento, nivel, link_info['title'])
                        if contest:
                            contests.append(contest)
                    except Exception as e:
                        logger.error(f"Error scraping contest {link_info['url']}: {e}")
                        continue
                
                logger.info(f"Encontrados {len(contests)} concursos en {departamento} - {nivel}")
                return contests
                
        except Exception as e:
            logger.error(f"Error en _scrape_department_level: {e}")
            return []
    
    def _find_contest_links(self, soup: BeautifulSoup, base_url: str) -> List[Dict]:
        """Buscar enlaces a concursos en la página"""
        contest_links = []
        
        # Patrones de búsqueda de concursos
        contest_patterns = [
            r'concurso',
            r'oposicion',
            r'ascenso',
            r'cargo',
            r'cátedra',
            r'docente',
            r'directivo',
            r'supervisor'
        ]
        
        # Buscar todos los enlaces
        links = soup.find_all('a', href=True)
        
        for link in links:
            href = link.get('href', '')
            title = link.get_text(strip=True)
            
            # Verificar si el enlace parece ser un concurso
            if any(re.search(pattern, href, re.IGNORECASE) or 
                   re.search(pattern, title, re.IGNORECASE) 
                   for pattern in contest_patterns):
                
                full_url = urljoin(base_url, href)
                
                # Filtrar enlaces irrelevantes
                if self._is_contest_link(href, title):
                    contest_links.append({
                        'url': full_url,
                        'title': title,
                        'href': href
                    })
        
        return contest_links
    
    def _is_contest_link(self, href: str, title: str) -> bool:
        """Determinar si un enlace es realmente de un concurso"""
        # Excluir enlaces que no son de concursos
        exclude_patterns = [
            r'page/\d+',
            r'category',
            r'tag',
            r'author',
            r'comment',
            r'reply',
            r'feed',
            r'pdf$',
            r'doc$',
            r'xls$'
        ]
        
        href_lower = href.lower()
        title_lower = title.lower()
        
        # Excluir patrones no deseados
        for pattern in exclude_patterns:
            if re.search(pattern, href_lower):
                return False
        
        # Incluir solo si tiene palabras clave de concursos
        include_patterns = [
            r'concurso',
            r'oposicion',
            r'ascenso',
            r'cargo.*docente',
            r'cátedra',
            r'nombramiento',
            r'provision',
            r'cobertura'
        ]
        
        return any(re.search(pattern, title_lower) for pattern in include_patterns)
    
    async def _scrape_contest_page(self, url: str, departamento: str, nivel: str, link_title: str) -> Optional[ScrapedContest]:
        """Extraer información detallada de una página de concurso"""
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    return None
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
            
            # Extraer título
            title_elem = soup.find('h1') or soup.find('h2') or soup.find('title')
            if title_elem:
                title_text = title_elem.get_text(strip=True)
            else:
                title_text = link_title
            
            # Extraer contenido principal
            content = self._extract_main_content(soup)
            description = content[:500] + "..." if len(content) > 500 else content
            
            # Extraer información estructurada
            details = self._extract_contest_details(content, soup)
            
            # Crear el contest con los datos correctos
            contest = ScrapedContest(
                title=title_text,
                description=description,
                date=datetime.now(),
                registration_deadline=details.get('fecha_cierre'),
                school_name=details.get('institucion', f'Escuela {departamento.title()}'),
                school_city=departamento.title(),
                school_department="Entre Ríos",
                school_address=details.get('direccion'),
                subject_name=details.get('cargo', 'Docente'),
                source_url=url,
                source_name="CGE Entre Ríos",
                level=self._parse_nivel_from_string(nivel),
                shift=details.get('turno'),
                schedule=details.get('horario'),
                hours_to_cover=details.get('horas'),
                contract_type=details.get('tipo_contrato')
            )
            
            # Validar que tenga información mínima
            if contest.title and len(contest.title) > 5:
                return contest
            
        except Exception as e:
            logger.error(f"Error scraping contest page {url}: {e}")
        
        return None
    
    def _extract_main_content(self, soup: BeautifulSoup) -> str:
        """Extraer el contenido principal de la página"""
        content_selectors = [
            'div.entry-content',
            'div.post-content',
            'div.content',
            'main',
            'article',
            'div.site-content'
        ]
        
        for selector in content_selectors:
            content_elem = soup.select_one(selector)
            if content_elem:
                return content_elem.get_text(strip=True, separator=' ')
        
        # Si no encuentra contenido específico, extraer todo el body
        body = soup.find('body')
        if body:
            return body.get_text(strip=True, separator=' ')
        
        return ""
    
    def _extract_contest_details(self, content: str, soup: BeautifulSoup) -> Dict[str, Any]:
        """Extraer detalles estructurados del concurso"""
        content_lower = content.lower()
        details = {}
        
        # Extraer información de cargo
        cargo_patterns = [
            r'cargo[:\s]+([^.]+)',
            r'puesto[:\s]+([^.]+)',
            r'plaza[:\s]+([^.]+)',
            r'vacante[:\s]+([^.]+)'
        ]
        
        for pattern in cargo_patterns:
            match = re.search(pattern, content_lower)
            if match:
                details['cargo'] = match.group(1).strip().title()
                break
        
        # Extraer institución
        institucion_patterns = [
            r'escuela[:\s]+([^.]+)',
            r'instituto[:\s]+([^.]+)',
            r'colegio[:\s]+([^.]+)',
            r'establecimiento[:\s]+([^.]+)'
        ]
        
        for pattern in institucion_patterns:
            match = re.search(pattern, content_lower)
            if match:
                details['institucion'] = match.group(1).strip().title()
                break
        
        # Extraer fechas
        fecha_patterns = [
            r'cierre[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})',
            r'vencimiento[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})',
            r'presentación[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})',
            r'(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})'
        ]
        
        for pattern in fecha_patterns:
            match = re.search(pattern, content_lower)
            if match:
                try:
                    fecha_str = match.group(1)
                    details['fecha_cierre'] = self._parse_date(fecha_str)
                    break
                except:
                    continue
        
        return details
    
    def _parse_nivel_from_string(self, nivel_str: str) -> str:
        """Parsear nivel educativo desde string"""
        nivel_mapping = {
            'concursos-nivel-inicial': 'Inicial',
            'concursos-nivel-primario': 'Primario',
            'concursos-nivel-secundario': 'Secundario',
            'concursos-nivel-superior': 'Superior',
            'concursos-nivel-supervisor': 'Supervisor'
        }
        
        return nivel_mapping.get(nivel_str, 'No especificado')
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parsear fecha desde string"""
        date_formats = [
            '%d/%m/%Y',
            '%d-%m-%Y',
            '%Y-%m-%d',
            '%d/%m/%y',
            '%d-%m-%y'
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        
        return None
