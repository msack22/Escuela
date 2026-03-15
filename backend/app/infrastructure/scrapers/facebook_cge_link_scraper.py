import aiohttp
import asyncio
import re
import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, parse_qs
import logging
from pathlib import Path

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('C:/tmp/facebook_cge_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest


class FacebookCGELinkScraper(BaseScraper):
    """Scraper que extrae enlaces de Facebook y scrapea concursos reales del CGE"""
    
    def __init__(self):
        super().__init__(
            name="Facebook CGE Link Scraper",
            base_url="https://www.facebook.com"
        )
        
        # URLs específicos de Facebook con enlaces a CGE
        self.facebook_urls = [
            "https://www.facebook.com/story.php?story_fbid=1577314907728654&id=100063504790806&rdid=nClQfbKP13fvU5R8",
            "https://www.facebook.com/share/p/1DzX6tJYZ5/"
        ]
        
        # URLs base del CGE para scraping directo
        self.cge_base_urls = [
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-3-francisco-ramirez-ibicuy-3/",
            "https://cge.entrerios.gov.ar/2026/03/se-desconvoca-llamado-a-concurso-nivel-secundario-e-e-t-no-5-libertador-san-martin-diamante/",
            "https://cge.entrerios.gov.ar/2026/03/llamado-a-concurso-nivel-primario-esc-nina-no-39-las-masitas-diamante-5/",
            "https://cge.entrerios.gov.ar/2026/03/llamado-a-concurso-nivel-primario-esc-nina-no-11-gral-racedo-diamante-5/",
            "https://cge.entrerios.gov.ar/2026/03/llamado-a-concurso-instituto-superior-de-formacion-docente-dr-miguel-puiggari-de-libertador-san-martin-diamante-3/",
            "https://cge.entrerios.gov.ar/2026/03/supervisor-de-educacion-secundaria-zona-xxi-departamento-uruguay/",
            "https://cge.entrerios.gov.ar/2026/03/llamado-a-concurso-instituto-superior-de-formacion-docente-continua-villa-paranacito-islas/"
        ]
    
    def _extract_cge_urls_from_facebook(self, content: str) -> List[str]:
        """Extraer URLs del CGE desde contenido de Facebook"""
        cge_urls = []
        
        # Patrones para encontrar URLs del CGE
        patterns = [
            r'https://cge\.entrerios\.gov\.ar/[^\s\)]+',
            r'cge\.entrerios\.gov\.ar/[^\s\)]+',
            r'https://cge\.entrerios\.gov\.ar/[^\\s\\)\\"]+',
            r'cge\.entrerios\.gov\.ar/[^\\s\\)\\"]+'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                # Asegurar que la URL sea completa
                if not match.startswith('http'):
                    match = 'https://' + match
                
                # Limpiar caracteres extraños al final
                match = re.sub(r'[^a-zA-Z0-9\-_./?=&]+$', '', match)
                
                if match not in cge_urls:
                    cge_urls.append(match)
        
        return cge_urls
    
    def _parse_contest_from_cge_content(self, content: str, source_url: str) -> Optional[ScrapedContest]:
        """Parsear contenido del CGE para extraer información del concurso"""
        try:
            soup = BeautifulSoup(content, 'html.parser')
            
            # Extraer título
            title = ""
            title_elem = soup.find('h1') or soup.find('title')
            if title_elem:
                title = title_elem.get_text().strip()
            
            # Extraer descripción del contenido principal
            description = ""
            content_div = soup.find('div', class_='entry-content') or soup.find('main') or soup.find('article')
            if content_div:
                description = content_div.get_text().strip()[:500]
            
            # Extraer información específica del concurso
            contest_info = {
                'title': title,
                'description': description,
                'source_url': source_url,
                'is_active': True,
                'date': datetime.now().isoformat(),
                'registration_deadline': (datetime.now() + timedelta(days=30)).isoformat()
            }
            
            # Extraer información específica del texto
            text_content = title + " " + description
            text_lower = text_content.lower()
            
            # Detectar escuela específica
            school_patterns = [
                r'escuela\s+(?:secundaria|primaria|inicial|especial)\s+n[°°]?\s*(\d+)',
                r'escuela\s+(?:secundaria|primaria|inicial|especial)\s+"([^"]+)"',
                r'instituto\s+(?:superior\s+de\s+formación\s+docente\s+continua)?\s*([^,\s]+)',
                r'([^,\s]+)\s*–\s*([^,\s]+)'
            ]
            
            for pattern in school_patterns:
                match = re.search(pattern, text_content, re.IGNORECASE)
                if match:
                    if 'escuela' in pattern.lower():
                        school_type = re.search(r'(secundaria|primaria|inicial|especial)', pattern.lower()).group(1)
                        school_number = match.group(1)
                        contest_info['school_name'] = f"Escuela {school_type.title()} N°{school_number}"
                    else:
                        contest_info['school_name'] = match.group(1).strip()
                    break
            
            # Detectar materia/cargo específico
            subject_keywords = {
                'física': 'Física',
                'química': 'Química',
                'matemática': 'Matemática',
                'lengua': 'Lengua y Literatura',
                'historia': 'Historia',
                'geografía': 'Geografía',
                'biología': 'Biología',
                'educación física': 'Educación Física',
                'inglés': 'Inglés',
                'supervisor': 'Supervisor Educativo',
                'rector': 'Rector',
                'director': 'Director',
                'secretario': 'Secretario',
                'educación inicial': 'Educación Inicial',
                'educación primaria': 'Educación Primaria',
                'educación secundaria': 'Educación Secundaria',
                'educación especial': 'Educación Especial',
                'formación docente': 'Formación Docente'
            }
            
            for keyword, subject in subject_keywords.items():
                if keyword in text_lower:
                    contest_info['subject_name'] = subject
                    break
            
            # Detectar departamento
            dept_keywords = {
                'ibicuy': 'Islas del Ibicuy',
                'diamante': 'Diamante',
                'libertador san martín': 'Diamante',
                'paraná': 'Paraná',
                'concordia': 'Concordia',
                'colón': 'Colón',
                'gualeguaychú': 'Gualeguaychú',
                'gualeguay': 'Gualeguay',
                'villaguay': 'Villaguay',
                'uruguay': 'Uruguay',
                'la paz': 'La Paz',
                'nogoyá': 'Nogoyá',
                'federal': 'Federal',
                'san salvador': 'San Salvador',
                'victoria': 'Victoria',
                'federación': 'Federación',
                'feliciano': 'Feliciano',
                'tala': 'Tala'
            }
            
            for keyword, dept in dept_keywords.items():
                if keyword in text_lower:
                    contest_info['school_department'] = dept
                    break
            
            # Detectar ciudad/localidad
            city_patterns = [
                r'ciudad\s+de\s+([a-zA-Z\s]+)',
                r'localidad\s+de\s+([a-zA-Z\s]+)',
                r'sita\s+en\s+([a-zA-Z\s]+)',
                r'([a-zA-Z\s]+),\s+depto\.?\s+[a-zA-Z\s]+'
            ]
            
            for pattern in city_patterns:
                match = re.search(pattern, text_content, re.IGNORECASE)
                if match:
                    contest_info['school_city'] = match.group(1).strip()
                    break
            
            # Extraer fecha del concurso
            date_patterns = [
                r'(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})',
                r'(\d{1,2})/(\d{1,2})/(\d{4})',
                r'(\d{4})/(\d{1,2})/(\d{1,2})'
            ]
            
            for pattern in date_patterns:
                match = re.search(pattern, text_content)
                if match:
                    try:
                        if len(match.groups()) == 3:
                            if match.group(1).isdigit() and len(match.group(1)) <= 2:
                                # Formato día/mes/año o día de mes de año
                                day = int(match.group(1))
                                month_name = match.group(2).lower()
                                year = int(match.group(3))
                                
                                # Convertir nombre de mes a número
                                month_map = {
                                    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
                                    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
                                    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
                                }
                                
                                if month_name in month_map:
                                    month = month_map[month_name]
                                elif month_name.isdigit():
                                    month = int(month_name)
                                else:
                                    continue
                            else:
                                # Formato año/mes/día
                                year = int(match.group(1))
                                month = int(match.group(2))
                                day = int(match.group(3))
                            
                            contest_date = datetime(year, month, day)
                            contest_info['date'] = contest_date.isoformat()
                            contest_info['registration_deadline'] = (contest_date + timedelta(days=7)).isoformat()
                            break
                    except:
                        continue
            
            # Valores por defecto si no se encontraron
            if not contest_info.get('school_name'):
                contest_info['school_name'] = 'Escuela CGE Entre Ríos'
            if not contest_info.get('school_city'):
                contest_info['school_city'] = contest_info.get('school_department', 'Entre Ríos')
            if not contest_info.get('subject_name'):
                contest_info['subject_name'] = 'Educación'
            
            return ScrapedContest(
                title=contest_info['title'],
                description=contest_info['description'],
                date=contest_info['date'],
                registration_deadline=contest_info['registration_deadline'],
                school_name=contest_info['school_name'],
                school_city=contest_info['school_city'],
                school_department=contest_info['school_department'],
                subject_name=contest_info['subject_name'],
                source_url=contest_info['source_url'],
                is_active=contest_info['is_active']
            )
            
        except Exception as e:
            logger.error(f"Error parseando concurso del CGE: {e}")
            return None
    
    async def scrape_facebook_post(self, facebook_url: str) -> List[str]:
        """Scrapear post de Facebook para extraer URLs del CGE"""
        cge_urls = []
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
            
            async with aiohttp.ClientSession(headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as session:
                logger.info(f"🔍 Scrapeando post de Facebook: {facebook_url}")
                
                async with session.get(facebook_url) as response:
                    if response.status == 200:
                        content = await response.text()
                        
                        # Extraer URLs del CGE del contenido
                        extracted_urls = self._extract_cge_urls_from_facebook(content)
                        cge_urls.extend(extracted_urls)
                        
                        logger.info(f"✅ Se encontraron {len(extracted_urls)} URLs del CGE en el post")
                        
                    else:
                        logger.warning(f"No se pudo acceder al post de Facebook: {response.status}")
                        
        except Exception as e:
            logger.error(f"Error scrapeando post de Facebook {facebook_url}: {e}")
        
        return cge_urls
    
    async def scrape_cge_contest(self, cge_url: str) -> Optional[ScrapedContest]:
        """Scrapear concurso específico del CGE"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br'
            }
            
            async with aiohttp.ClientSession(headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as session:
                logger.info(f"🔍 Scrapeando concurso del CGE: {cge_url}")
                
                async with session.get(cge_url) as response:
                    if response.status == 200:
                        content = await response.text()
                        
                        # Parsear el concurso del contenido
                        contest = self._parse_contest_from_cge_content(content, cge_url)
                        if contest:
                            logger.info(f"✅ Concurso parseado: {contest.title}")
                            return contest
                    
                    else:
                        logger.warning(f"No se pudo acceder al concurso del CGE: {response.status}")
                        
        except Exception as e:
            logger.error(f"Error scrapeando concurso del CGE {cge_url}: {e}")
        
        return None
    
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """Scrape contests from Facebook posts with CGE links"""
        contests = []
        
        logger.info("🚀 Iniciando scraper Facebook-CGE - Extracción de concursos reales")
        logger.info(f"📊 Objetivo: {limit if limit else 'Todos los concursos'}")
        
        try:
            # Paso 1: Extraer URLs del CGE desde posts de Facebook
            all_cge_urls = []
            
            for facebook_url in self.facebook_urls:
                cge_urls = await self.scrape_facebook_post(facebook_url)
                all_cge_urls.extend(cge_urls)
            
            # Agregar URLs base conocidas del CGE
            all_cge_urls.extend(self.cge_base_urls)
            
            # Eliminar duplicados
            all_cge_urls = list(set(all_cge_urls))
            
            logger.info(f"📎 Total de URLs del CGE a procesar: {len(all_cge_urls)}")
            
            # Paso 2: Scrapear cada concurso del CGE
            tasks = []
            for cge_url in all_cge_urls:
                task = self.scrape_cge_contest(cge_url)
                tasks.append(task)
            
            # Ejecutar scraping en paralelo
            logger.info("🔄 Iniciando scraping paralelo de concursos del CGE...")
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Procesar resultados
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Error en scraping paralelo: {result}")
                elif isinstance(result, ScrapedContest):
                    contests.append(result)
            
            # Eliminar duplicados
            seen_urls = set()
            unique_contests = []
            for contest in contests:
                if contest.source_url not in seen_urls:
                    seen_urls.add(contest.source_url)
                    unique_contests.append(contest)
            
            # Aplicar límite si se especifica
            if limit and len(unique_contests) > limit:
                unique_contests = unique_contests[:limit]
            
            logger.info(f"✅ Scraping Facebook-CGE completado: {len(unique_contests)} concursos reales encontrados")
            return unique_contests
            
        except Exception as e:
            logger.error(f"Error general en scraping Facebook-CGE: {e}")
            return contests
    
    def is_available(self) -> bool:
        """Verificar disponibilidad del scraper"""
        try:
            import aiohttp
            import asyncio
            
            async def check():
                headers = {'User-Agent': 'Mozilla/5.0'}
                async with aiohttp.ClientSession(headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as session:
                    # Verificar acceso a Facebook y CGE
                    facebook_response = await session.get("https://www.facebook.com/")
                    cge_response = await session.get("https://cge.entrerios.gov.ar/")
                    
                    return (facebook_response.status in [200, 302] and 
                           cge_response.status == 200)
            
            return asyncio.run(check())
        except:
            return False
