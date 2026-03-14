import aiohttp
import asyncio
from bs4 import BeautifulSoup
from typing import List, Optional
from datetime import datetime
import re
from urllib.parse import urljoin

from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest


class EducacionGobScraper(BaseScraper):
    """Scraper for educación.gob.ar or similar government education sites"""
    
    def __init__(self):
        super().__init__(
            name="Educación Argentina",
            base_url="https://www.argentina.gob.ar/educacion"
        )
    
    async def scrape_contests(self) -> List[ScrapedContest]:
        """Scrape contests from government education website"""
        contests = []
        
        try:
            async with aiohttp.ClientSession() as session:
                # Try different common paths for contests
                urls_to_try = [
                    f"{self.base_url}/concursos",
                    f"{self.base_url}/concursos-docentes",
                    f"{self.base_url}/convocatorias",
                    f"{self.base_url}/llamados-a-concurso"
                ]
                
                for url in urls_to_try:
                    try:
                        async with session.get(url, timeout=10) as response:
                            if response.status == 200:
                                html = await response.text()
                                page_contests = await self._parse_contests_page(html, url)
                                contests.extend(page_contests)
                    except Exception as e:
                        print(f"Error scraping {url}: {e}")
                        continue
                        
        except Exception as e:
            print(f"Error in EducacionGobScraper: {e}")
        
        return contests
    
    async def _parse_contests_page(self, html: str, source_url: str) -> List[ScrapedContest]:
        """Parse contest information from HTML page"""
        contests = []
        soup = BeautifulSoup(html, 'html.parser')
        
        # Look for common contest container patterns
        contest_selectors = [
            '.convocatoria-item',
            '.concurso-item',
            '.llamado-item',
            '.card',
            '.list-item',
            'article',
            '.row'
        ]
        
        for selector in contest_selectors:
            items = soup.select(selector)
            if items:
                for item in items:
                    try:
                        contest = await self._extract_contest_info(item, source_url)
                        if contest:
                            contests.append(contest)
                    except Exception as e:
                        print(f"Error extracting contest info: {e}")
                break  # Stop after finding items
        
        return contests
    
    async def _extract_contest_info(self, item_element, source_url: str) -> Optional[ScrapedContest]:
        """Extract contest information from a page element"""
        try:
            # Extract title
            title_selectors = ['h1', 'h2', 'h3', '.title', '.titulo', 'a[title]']
            title = ""
            for selector in title_selectors:
                title_elem = item_element.select_one(selector)
                if title_elem:
                    title = self.normalize_text(title_elem.get_text() or title_elem.get('title', ''))
                    if title:
                        break
            
            if not title:
                return None
            
            # Extract description
            desc_selectors = ['.description', '.descripcion', 'p', '.content']
            description = ""
            for selector in desc_selectors:
                desc_elem = item_element.select_one(selector)
                if desc_elem:
                    description = self.normalize_text(desc_elem.get_text())
                    if description and len(description) > 20:  # Avoid short, irrelevant text
                        break
            
            # Extract date information
            date_text = ""
            date_patterns = [
                r'(\d{1,2}/\d{1,2}/\d{4})',
                r'(\d{1,2}-\d{1,2}-\d{4})',
                r'(\d{4}-\d{2}-\d{2})',
                r'(\d{1,2}\sde\s\w+\sde\s\d{4})'
            ]
            
            item_text = item_element.get_text()
            for pattern in date_patterns:
                match = re.search(pattern, item_text)
                if match:
                    date_text = match.group(1)
                    break
            
            contest_date = self.parse_date(date_text) if date_text else datetime.now()
            
            # Extract location information
            location_text = item_element.get_text().lower()
            city = self._extract_city(location_text)
            department = self._extract_department(location_text)
            
            # Extract subject (materia)
            subject = self._extract_subject(title + " " + description)
            
            # Extract additional contest details
            level = self._extract_contest_level(item_text)
            shift = self._extract_contest_shift(item_text)
            schedule = self._extract_contest_schedule(item_text)
            hours = self._extract_hours_to_cover(item_text)
            contract = self._extract_contract_type(item_text)
            
            # Get source URL
            link_elem = item_element.select_one('a[href]')
            contest_url = urljoin(source_url, link_elem.get('href')) if link_elem else source_url
            
            return ScrapedContest(
                title=title,
                description=description,
                date=contest_date,
                registration_deadline=None,
                school_name="Ministerio de Educación",
                school_city=city,
                school_department=department,
                school_address=None,
                subject_name=subject,
                source_url=contest_url,
                source_name=self.name,
                level=level,
                shift=shift,
                schedule=schedule,
                hours_to_cover=hours,
                contract_type=contract
            )
            
        except Exception as e:
            print(f"Error extracting contest info: {e}")
            return None
    
    def _extract_city(self, text: str) -> str:
        """Extract city name from text"""
        cities = [
            'buenos aires', 'córdoba', 'rosario', 'mendoza', 'la plata',
            'mar del plata', 'salta', 'santa fe', 'san juan', 'tucumán'
        ]
        
        text_lower = text.lower()
        for city in cities:
            if city in text_lower:
                return city.title()
        
        return "Buenos Aires"  # Default
    
    def _extract_department(self, text: str) -> str:
        """Extract department from text"""
        departments = [
            'capital federal', 'gba norte', 'gba sur', 'gba oeste',
            'conurbano bonaerense'
        ]
        
        text_lower = text.lower()
        for dept in departments:
            if dept in text_lower:
                return dept.title()
        
        return "Capital Federal"  # Default
    
    def _extract_contest_level(self, text: str) -> str:
        """Extract contest level from text"""
        levels = ['inicial', 'primaria', 'secundaria', 'jardin', 'nivel inicial']
        text_lower = text.lower()
        
        for level in levels:
            if level in text_lower:
                return level.title()
        return None
    
    def _extract_contest_shift(self, text: str) -> str:
        """Extract contest shift from text"""
        shifts = ['mañana', 'tarde', 'jornada completa', 'vespertina', 'nocturna']
        text_lower = text.lower()
        
        for shift in shifts:
            if shift in text_lower:
                return shift.title()
        return None
    
    def _extract_contest_schedule(self, text: str) -> str:
        """Extract contest schedule from text"""
        schedule_patterns = [
            r'(\d{1,2}:\d{2}\s*a\s*m\.?\s*\d{1,2}:\d{2})',  # 9:00 a 12:30
            r'(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})',    # 9:00-12:30
            r'(\d{1,2}\s*hs\s*a\s*\d{1,2}\s*hs)',           # 9 hs a 12 hs
        ]
        
        for pattern in schedule_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_hours_to_cover(self, text: str) -> int:
        """Extract number of hours to cover from text"""
        patterns = [
            r'(\d+)\s*hor[aá]s?',                    # 20 horas
            r'(\d+)\s*hs\.?',                        # 20 hs
            r'carga\s+horaria\s+de\s+(\d+)',          # carga horaria de 20
            r'(\d+)\s*módulos?',                      # 20 módulos
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text.lower())
            if match:
                return int(match.group(1))
        
        return None
    
    def _extract_contract_type(self, text: str) -> str:
        """Extract contract type from text"""
        contract_types = [
            'titular', 'suplente', 'interino', 'contratado', 
            'temporario', 'reemplazo', 'carga horaria', 'simple'
        ]
        
        text_lower = text.lower()
        for contract in contract_types:
            if contract in text_lower:
                return contract.title()
        
        return None
    
    def _extract_subject(self, text: str) -> str:
        """Extract subject/materia from text"""
        subjects = [
            'matemática', 'lengua', 'historia', 'geografía', 'ciencias naturales',
            'ciencias sociales', 'educación física', 'inglés', 'música', 'plástica',
            'filosofía', 'biología', 'física', 'química', 'informática'
        ]
        
        text_lower = text.lower()
        for subject in subjects:
            if subject in text_lower:
                return subject.title()
        
        return "General"  # Default
    
    def is_available(self) -> bool:
        """Check if the website is available"""
        try:
            import aiohttp
            import asyncio
            
            async def check():
                try:
                    async with aiohttp.ClientSession() as session:
                        async with session.get(self.base_url, timeout=5) as response:
                            return response.status == 200
                except:
                    return False
            
            return asyncio.run(check())
        except:
            return False
