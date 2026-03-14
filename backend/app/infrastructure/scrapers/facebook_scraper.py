import aiohttp
import asyncio
from typing import List, Optional
from datetime import datetime
import re
from urllib.parse import urljoin

from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest


class FacebookScraper(BaseScraper):
    """Scraper para buscar concursos en páginas de Facebook relacionadas con Entre Ríos"""
    
    def __init__(self):
        super().__init__(
            name="Facebook Pages - Entre Ríos",
            base_url="https://www.facebook.com"
        )
    
    async def scrape_contests(self) -> List[ScrapedContest]:
        """Scrape contests from Facebook pages related to Entre Ríos"""
        contests = []
        
        # Términos de búsqueda específicos para Entre Ríos
        search_terms = [
            "concurso docente Entre Ríos",
            "convocatoria docente Concepción",
            "cargo docente Entre Ríos",
            "puesto educativo Paraná",
            "llamado a concurso Entre Ríos",
            "vacante docente Concepción Uruguay",
            "oposición docente Entre Ríos",
            "concurso magisterio Entre Ríos",
            "cargo directivo escuela Entre Ríos",
            "nombramiento cargo educativo Entre Ríos"
        ]
        
        try:
            async with aiohttp.ClientSession() as session:
                # Buscar páginas públicas de educación de Entre Ríos
                for term in search_terms:
                    search_url = f"https://www.facebook.com/search/pages/?q={term.replace(' ', '%20')}"
                    
                    async with session.get(search_url, timeout=10) as response:
                        if response.status == 200:
                            html = await response.text()
                            soup = BeautifulSoup(html, 'html.parser')
                            
                            # Buscar enlaces a páginas
                            page_links = self._extract_page_links(soup)
                            
                            for link in page_links:
                                contest = await self._scrape_facebook_page(session, link)
                                if contest:
                                    contests.append(contest)
                            
                            # Pequeña pausa para no sobrecargar
                            await asyncio.sleep(1)
        
        except Exception as e:
            print(f"Error scraping Facebook: {e}")
        
        return contests
    
    def _extract_page_links(self, soup: BeautifulSoup) -> List[str]:
        """Extraer enlaces a páginas desde resultados de búsqueda"""
        links = []
        
        # Buscar enlaces que puedan ser páginas de Facebook
        link_elements = soup.find_all('a', href=True)
        
        for link_elem in link_elements:
            href = link_elem.get('href', '')
            text = link_elem.get_text().lower()
            
            # Filtrar enlaces relevantes
            if any(keyword in text for keyword in ['facebook.com', 'pages']) and href:
                # Evitar enlaces a perfiles, grupos, etc.
                if 'facebook.com/pages/' in href or 'facebook.com/' in href:
                    links.append(href)
        
        return list(set(links))  # Eliminar duplicados
    
    async def _scrape_facebook_page(self, session: aiohttp.ClientSession, page_url: str) -> Optional[ScrapedContest]:
        """Scrapear una página específica de Facebook"""
        try:
            async with session.get(page_url, timeout=15) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Extraer información de la página
                    title = self._extract_title(soup)
                    description = self._extract_description(soup)
                    text_content = soup.get_text()
                    
                    if title:
                        # Extraer información del concurso
                        level = self._extract_level(text_content)
                        shift = self._extract_shift(text_content)
                        schedule = self._extract_schedule(text_content)
                        hours = self._extract_hours(text_content)
                        contract_type = self._extract_contract_type(text_content)
                        date = self._extract_date(text_content)
                        deadline = self._extract_deadline(text_content)
                        
                        # Extraer información de la escuela
                        school_name = self._extract_school_name(text_content)
                        school_city = self._extract_city(text_content)
                        school_department = self._extract_department(text_content)
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
                            source_url=page_url,
                            source_name=self.name,
                            level=level,
                            shift=shift,
                            schedule=schedule,
                            hours_to_cover=hours,
                            contract_type=contract_type
                        )
        
        except Exception as e:
            print(f"Error scraping Facebook page {page_url}: {e}")
            return None
    
    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extraer título de una página de Facebook"""
        # Buscar en diferentes selectores comunes en Facebook
        title_selectors = [
            'h1', 'h2',
            '[data-testid="story-subtitle"]',
            '[role="heading"]',
            '.uiIntelligentFormTitle',
            '.fbPageBannerHeader'
        ]
        
        for selector in title_selectors:
            title_elem = soup.select_one(selector)
            if title_elem:
                title = self.normalize_text(title_elem.get_text())
                if title and len(title) > 10:  # Título razonable
                    return title
        return ""
    
    def _extract_description(self, soup: BeautifulSoup) -> str:
        """Extraer descripción de una página de Facebook"""
        # Buscar en diferentes selectores para descripciones
        desc_selectors = [
            '[data-testid="story-subtitle"]',
            '[role="heading"] + p',
            '.uiIntelligentFormTitle + div',
            '.fbPageBannerHeader + div',
            'div[data-testid="story-subtitle"] + div'
        ]
        
        for selector in desc_selectors:
            desc_elem = soup.select_one(selector)
            if desc_elem:
                desc = self.normalize_text(desc_elem.get_text())
                if desc and len(desc) > 20:  # Descripción razonable
                    return desc
        return ""
    
    def _extract_level(self, text: str) -> str:
        """Extraer nivel educativo del texto"""
        levels = ['inicial', 'primaria', 'secundaria', 'jardín', 'nivel inicial']
        text_lower = text.lower()
        
        for level in levels:
            if level in text_lower:
                return level.title()
        return "Secundaria"
    
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
            r'(\d{1,2}):\d{2}\s*-\s*(\d{1,2}):(\d{2})',
            r'(\d{1,2}):\d{2}\s*-\s*(\d{1,2}):(\d{2})',
            r'(\d{1,2})\s*hs\s*a\s*\d{1,2})\s*hs'
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
            r'(\d+)\s*h\s*cátedras?'
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
            'temporario', 'reemplazo', 'carga horaria', 'simple'
        ]
        
        text_lower = text.lower()
        for contract in contract_types:
            if contract in text_lower:
                return contract.title()
        return None
    
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
                
                if year < 100:
                    year = current_year
                
                try:
                    month_names = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
                    month_num = month_names.index(month) + 1 if month in month_names else 1
                    
                    return datetime(year, month_num, int(day))
                except ValueError:
                    continue
        
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
    
    def _extract_school_name(self, text: str) -> str:
        """Extraer nombre de la escuela del texto"""
        school_patterns = [
            r'escuela\s+([^\s,\.]+)',
            r'esc\.\s*([^\s,\.]+)',
            r'instituto\s+([^\s,\.]+)',
            r'colegio\s+([^\s,\.]+)',
            r'([A-Z][a-záéíóúñ\s]+[Nn]°\s*\d+)',
            r'(Dirección\s+General\s+de\s+Escuelas\s+([^\s,\.]+)',
            r'(Supervisión\s+de\s+Educación\s+([^\s,\.]+)'
        ]
        
        for pattern in school_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        return "Escuela Pública"
    
    def _extract_city(self, text: str) -> str:
        """Extraer ciudad del texto"""
        cities = ['concepción', 'paraná', 'uruguayana', 'gualeguay', 'fray bentos', 'nueva palmira', 'colonias', 'villa elisa']
        text_lower = text.lower()
        
        for city in cities:
            if city in text_lower:
                return city.title()
        return "Concepción"
    
    def _extract_department(self, text: str) -> str:
        """Extraer departamento del texto"""
        departments = ['concepción', 'paraná', 'uruguay', 'gualeguaychú', 'fray bentos', 'colonias', 'villa elisa']
        text_lower = text.lower()
        
        for dept in departments:
            if dept in text_lower:
                return dept.title()
        return "Concepción"
    
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
        return "Educación"
    
    def is_available(self) -> bool:
        """Check if the scraper source is available"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, timeout=5) as response:
                    return response.status == 200
        except:
            return False
