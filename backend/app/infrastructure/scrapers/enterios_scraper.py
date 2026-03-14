import aiohttp
import asyncio
from bs4 import BeautifulSoup
from typing import List, Optional
from datetime import datetime
import re
from urllib.parse import urljoin

from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest


class EntreriosScraper(BaseScraper):
    """Scraper para el sitio de concursos de Entre Ríos"""
    
    def __init__(self):
        super().__init__(
            name="Consejo General de Educación Entre Ríos",
            base_url="https://cge.entrerios.gov.ar"
        )
    
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """Scrape contests from Entre Ríos website"""
        contests = []
        
        try:
            async with aiohttp.ClientSession() as session:
                # La URL proporcionada parece ser una convocatoria específica
                # Vamos a intentar acceder directamente
                async with session.get(self.base_url, timeout=15) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Buscar información de concursos en la página
                        contest_info = self._extract_contest_info(soup, self.base_url)
                        if contest_info:
                            contests.append(contest_info)
                    
                    # Si no encontramos en la página principal, intentamos buscar en secciones
                    if not contests:
                        sections = self._find_contest_sections(soup)
                        for section in sections:
                            section_contests = await self._scrape_section(session, section)
                            contests.extend(section_contests)
        
        except Exception as e:
            print(f"Error scraping {self.name}: {e}")
        
        return contests
    
    def _find_contest_sections(self, soup: BeautifulSoup) -> List[str]:
        """Encontrar secciones que puedan contener concursos"""
        sections = []
        
        # Buscar enlaces que puedan llevar a concursos
        links = soup.find_all('a', href=True)
        for link in links:
            href = link.get('href', '')
            text = link.get_text().lower()
            
            # Buscar palabras clave que indiquen concursos
            if any(keyword in text for keyword in ['concurso', 'convocatoria', 'llamado', 'cargo', 'puesto']):
                if href.startswith('/'):
                    full_url = urljoin(self.base_url, href)
                    sections.append(full_url)
        
        return list(set(sections))  # Eliminar duplicados
    
    async def _scrape_section(self, session: aiohttp.ClientSession, section_url: str) -> List[ScrapedContest]:
        """Scrape una sección específica del sitio"""
        contests = []
        
        try:
            async with session.get(section_url, timeout=10) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    contest_info = self._extract_contest_info(soup, section_url)
                    if contest_info:
                        contests.append(contest_info)
        
        except Exception as e:
            print(f"Error scraping section {section_url}: {e}")
        
        return contests
    
    def _extract_contest_info(self, soup: BeautifulSoup, source_url: str) -> Optional[ScrapedContest]:
        """Extraer información de un concurso de la página"""
        try:
            # Buscar el título principal o encabezado
            title_selectors = [
                'h1', 'h2', 'h3',
                '.title', '.titulo',
                '[class*="title"]', '[class*="titulo"]'
            ]
            
            title = ""
            for selector in title_selectors:
                title_elem = soup.select_one(selector)
                if title_elem:
                    title = self.normalize_text(title_elem.get_text())
                    break
            
            if not title:
                return None
            
            # Extraer descripción
            desc_selectors = [
                '.description', '.descripcion',
                'p', 'div[class*="content"]',
                '[class*="description"]', '[class*="descripcion"]'
            ]
            
            description = ""
            for selector in desc_selectors:
                desc_elem = soup.select_one(selector)
                if desc_elem:
                    description = self.normalize_text(desc_elem.get_text())
                    break
            
            # Extraer información del concurso
            text_content = soup.get_text()
            
            # Extraer nivel educativo
            level = self._extract_level(text_content)
            
            # Extraer turno
            shift = self._extract_shift(text_content)
            
            # Extraer horarios
            schedule = self._extract_schedule(text_content)
            
            # Extraer horas
            hours = self._extract_hours(text_content)
            
            # Extraer tipo de contrato
            contract_type = self._extract_contract_type(text_content)
            
            # Extraer fecha
            date = self._extract_date(text_content)
            
            # Extraer fecha de cierre
            deadline = self._extract_deadline(text_content)
            
            # Extraer información de la escuela
            school_name = self._extract_school_name(text_content)
            school_city = "Concepción"  # Por defecto, ya que es Entre Ríos
            school_department = "Concepción"
            
            # Extraer materia
            subject = self._extract_subject(title + " " + description)
            
            return ScrapedContest(
                title=title,
                description=description,
                date=date,
                registration_deadline=deadline,
                school_name=school_name,
                school_city=school_city,
                school_department=school_department,
                school_address=None,
                subject_name=subject,
                source_url=source_url,
                source_name=self.name,
                level=level,
                shift=shift,
                schedule=schedule,
                hours_to_cover=hours,
                contract_type=contract_type
            )
            
        except Exception as e:
            print(f"Error extracting contest info: {e}")
            return None
    
    def _extract_level(self, text: str) -> str:
        """Extraer nivel educativo del texto"""
        levels = ['inicial', 'primaria', 'secundaria', 'jardín', 'nivel inicial', 'educación inicial']
        text_lower = text.lower()
        
        for level in levels:
            if level in text_lower:
                return level.title()
        return "Secundaria"  # Default para concursos docentes
    
    def _extract_shift(self, text: str) -> str:
        """Extraer turno del texto"""
        shifts = ['mañana', 'tarde', 'jornada completa', 'vespertina', 'nocturna']
        text_lower = text.lower()
        
        for shift in shifts:
            if shift in text_lower:
                return shift.title()
        return None
    
    def _extract_schedule(self, text: str) -> str:
        """Extraer horarios del texto"""
        schedule_patterns = [
            r'(\d{1,2}:\d{2}\s*a\s*m\.?\s*\d{1,2}:\d{2})',
            r'(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})',
            r'(\d{1,2}\s*hs\s*a\s*\d{1,2}\s*hs)',
            r'(\d{1,2}\s*hs\.?\s*\d{1,2}\s*hs)',
            r'(\d{1,2}:\d{2}\s*a\s*\d{1,2}:\d{2}\s*hs)',
            r'de\s*\d{1,2}:\d{2}\s*a\s*\d{1,2}:\d{2}\s*hs',
            r'hasta\s*\d{1,2}:\d{2}\s*hs',
            r'esde\s*\d{1,2}:\d{2}\s*hs'
        ]
        
        for pattern in schedule_patterns:
            match = re.search(pattern, text.lower())
            if match:
                return match.group(1)
        
        return None
    
    def _extract_hours(self, text: str) -> int:
        """Extraer cantidad de horas del texto"""
        patterns = [
            r'(\d+)\s*hor[aá]s?',
            r'(\d+)\s*hs\.?',
            r'carga\s+horaria\s+de\s+(\d+)',
            r'(\d+)\s*módulos?',
            r'(\d+)\s*h\s*cátedras?',
            r'(\d+)\s*semanales?'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text.lower())
            if match:
                return int(match.group(1))
        
        return None
    
    def _extract_contract_type(self, text: str) -> str:
        """Extraer tipo de contrato del texto"""
        contract_types = [
            'titular', 'suplente', 'interino', 'contratado',
            'temporario', 'reemplazo', 'carga horaria', 'simple',
            'provisional', 'efectivo', 'estatutario'
        ]
        
        text_lower = text.lower()
        for contract in contract_types:
            if contract in text_lower:
                return contract.title()
        
        return None
    
    def _extract_school_name(self, text: str) -> str:
        """Extraer nombre de la escuela del texto"""
        # Buscar patrones comunes de nombres de escuelas
        school_patterns = [
            r'escuela\s+([^\s,\.]+)',
            r'esc\.\s*([^\s,\.]+)',
            r'instituto\s+([^\s,\.]+)',
            r'colegio\s+([^\s,\.]+)',
            r'([A-Z][a-záéíóúñ\s]+[Nn]°\s*\d+)'
        ]
        
        for pattern in school_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        return "Escuela Provincial"
    
    def _extract_date(self, text: str) -> datetime:
        """Extraer fecha del texto"""
        date_patterns = [
            r'(\d{1,2})/(\d{1,2})/(\d{4})',
            r'(\d{1,2})-(\d{1,2})-(\d{4})',
            r'(\d{1,2})\s*de\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*de\s*(\d{4})'
        ]
        
        current_year = datetime.now().year
        
        for pattern in date_patterns:
            match = re.search(pattern, text.lower())
            if match:
                day, month, year = match.groups()
                year = int(year)
                
                # Si el año parece incompleto, usar el actual
                if year < 100:
                    year = current_year
                
                try:
                    month_names = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
                    month_num = month_names.index(month) + 1 if month in month_names else 1
                    
                    return datetime(year, month_num, int(day))
                except ValueError:
                    continue
        
        # Si no encontramos fecha, devolver fecha por defecto (30 días desde ahora)
        return datetime.now() + timedelta(days=30)
    
    def _extract_deadline(self, text: str) -> datetime:
        """Extraer fecha límite de inscripción"""
        deadline_patterns = [
            r'cierre\s*:\s*(\d{1,2})/(\d{1,2})/(\d{4})',
            r'fecha\s+límite\s*:\s*(\d{1,2})/(\d{1,2})/(\d{4})',
            r'vencimiento\s*:\s*(\d{1,2})/(\d{1,2})/(\d{4})',
            r'inscripción\s*hasta\s*:\s*(\d{1,2})/(\d{1,2})/(\d{4})'
        ]
        
        for pattern in deadline_patterns:
            match = re.search(pattern, text.lower())
            if match:
                day, month, year = match.groups()
                year = int(year)
                
                if year < 100:
                    year = datetime.now().year
                
                try:
                    month_names = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
                    month_num = month_names.index(month) + 1 if month in month_names else 1
                    
                    return datetime(year, month_num, int(day))
                except ValueError:
                    continue
        
        return None
    
    def _extract_subject(self, text: str) -> str:
        """Extraer materia del texto"""
        subjects = [
            'matemática', 'lengua', 'historia', 'geografía', 'ciencias naturales',
            'ciencias sociales', 'educación física', 'inglés', 'música', 'plástica',
            'filosofía', 'biología', 'física', 'química', 'informática',
            'literatura', 'castellano', 'educación artística'
        ]
        
        text_lower = text.lower()
        for subject in subjects:
            if subject in text_lower:
                return subject.title()
        
        return "General"
    
    async def is_available(self) -> bool:
        """Check if the scraper source is available"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, timeout=5) as response:
                    return response.status == 200
        except:
            return False
