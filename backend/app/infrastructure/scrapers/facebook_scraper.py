import aiohttp
import asyncio
from typing import List, Optional, Dict
from datetime import datetime
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest
from app.infrastructure.scrapers.pattern_learning import PatternLearning


class FacebookScraper(BaseScraper):
    """Scraper mejorado para buscar concursos en Facebook - exploración completa"""
    
    def __init__(self):
        super().__init__(
            name="Facebook Pages - Entre Ríos",
            base_url="https://www.facebook.com"
        )
        self.pattern_learning = PatternLearning("facebook_patterns.json")
        self._initialize_facebook_patterns()
    
    def _initialize_facebook_patterns(self):
        """Inicializar patrones específicos de Facebook"""
        facebook_patterns = [
            {
                'type': 'facebook_dde',
                'pattern': r'facebook\.com/dde\w+',
                'description': 'Páginas de DDEs en Facebook',
                'examples': ['facebook.com/ddeislasdelibicuy', 'facebook.com/ddeparana'],
                'confidence': 0.9
            },
            {
                'type': 'facebook_cge',
                'pattern': r'facebook\.com/cge\w+',
                'description': 'Páginas del CGE en Facebook',
                'examples': ['facebook.com/cge.entrerios'],
                'confidence': 0.8
            },
            {
                'type': 'facebook_educacion',
                'pattern': r'facebook\.com/educacion\w+',
                'description': 'Páginas de Educación en Facebook',
                'examples': ['facebook.com/educacionentrerios'],
                'confidence': 0.7
            },
            {
                'type': 'facebook_amet',
                'pattern': r'facebook\.com/amet\w+',
                'description': 'Páginas de AMET en Facebook',
                'examples': ['facebook.com/AMETEntreRios'],
                'confidence': 0.8
            }
        ]
        
        self.pattern_learning.patterns_data['learned_patterns'] = facebook_patterns
        self.pattern_learning.patterns_data['last_updated'] = datetime.now().isoformat()
        self.pattern_learning._save_patterns()
        
        # Agregar las URLs específicas del usuario al aprendizaje
        specific_urls = [
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-formacion-etica-y-ciudadana-escuela-secundaria-n-3-francisco-ramirez/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-3-francisco-ramirez/",
            "https://cge.entrerios.gov.ar/departamental-islas-del-ibicuy/#concursos-nivel-secundario"
        ]
        
        for url in specific_urls:
            self.pattern_learning.learn_from_url(url, f"Concurso CGE - {url.split('/')[-2]}")
        
        # Agregar URL específica de Facebook del usuario
        facebook_url = "https://www.facebook.com/ddeislasdelibicuy"
        self.pattern_learning.learn_from_url(facebook_url, "Facebook DDE Islas del Ibicuy")
        
        stats = self.pattern_learning.get_statistics()
        print(f"📘 Patrones de Facebook inicializados: {stats['total_patterns']} patrones")
    
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """Scrape contests from Facebook - exploración exhaustiva"""
        contests = []
        visited_urls = set()
        
        try:
            # Headers para simular navegador real y evitar bloqueo de Facebook
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            }
            
            async with aiohttp.ClientSession(headers=headers) as session:
                # URLs específicas del usuario
                specific_urls = [
                    "https://www.facebook.com/ddeislasdelibicuy",  # Página específica de islas del ibicuy
                    "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-formacion-etica-y-ciudadana-escuela-secundaria-n-3-francisco-ramirez/",
                    "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-3-francisco-ramirez/",
                    "https://cge.entrerios.gov.ar/departamental-islas-del-ibicuy/#concursos-nivel-secundario",
                    "https://www.facebook.com/cge.entrerios",  # Consejo General de Educación
                    "https://www.facebook.com/educacionentrerios",  # Educación Provincial
                    "https://www.facebook.com/AMETEntreRios",  # AMET Asociación Magisterial
                    "https://www.facebook.com/ddeparana",  # DDE Paraná
                    "https://www.facebook.com/ddeconcepcion",  # DCE Concepción
                    "https://www.facebook.com/ddeuruguay",  # DDE Uruguay
                    "https://www.facebook.com/ddegualeguaychu",  # DDE Gualeguaychú
                    "https://www.facebook.com/ddeconcordia",  # DDE Concordia
                    "https://www.facebook.com/ddevillaguay",  # DDE Villaguay
                    "https://www.facebook.com/ddecolon",  # DDE Colón
                    "https://www.facebook.com/ddefeliciano",  # DDE Feliciano
                    "https://www.facebook.com/ddevictoria",  # DDE Victoria
                    "https://www.facebook.com/ddegualeguay",  # DDE Gualeguay
                    "https://www.facebook.com/ddelapaz",  # DDE La Paz
                    "https://www.facebook.com/ddehasenkamp",  # DDE Hasenkamp
                    "https://www.facebook.com/ddeherrera",  # DDE Herrera
                    "https://www.facebook.com/ddenogoya",  # DDE Nogoyá
                    "https://www.facebook.com/ddemaria",  # DDE María
                    "https://www.facebook.com/ddetala",  # DDE Rosario del Tala
                    "https://www.facebook.com/ddecrespo",  # DDE Crespo
                    "https://www.facebook.com/ddesaladas",  # DDE Saladas
                    "https://www.facebook.com/ddefederación",  # DDE Federación
                    "https://www.facebook.com/ddesanmarcos",  # DDE San Marcos
                    "https://www.facebook.com/ddesanjose",  # DDE San José
                    "https://www.facebook.com/ddesantaelena",  # DDE Santa Elena
                    "https://www.facebook.com/ddesauce",  # DDE Sauce
                    "https://www.facebook.com/ddesur",  # DDE Sur
                    "https://www.facebook.com/ddecentro",  # DDE Centro
                    "https://www.facebook.com/ddenorte",  # DDE Norte
                    "https://www.facebook.com/ddeoeste",  # DDE Oeste
                ]
                
                # Intentar procesar URLs específicas manualmente
                for url in specific_urls:
                    contest = self._create_manual_contest_from_url(url)
                    if contest:
                        contests.append(contest)
                        print(f"Concurso manual agregado desde Facebook: {contest.title}")
                
                # Páginas de educación de Entre Ríos para explorar (con limitaciones)
                education_pages = [
                    "https://www.facebook.com/ConsejoGeneraldeEducacionER",
                    "https://www.facebook.com/DGEEntreRios",
                    "https://www.facebook.com/educacionentrerios",
                    "https://www.facebook.com/escuelasentrerios",
                ]
                
                # Términos de búsqueda para encontrar más contenido
                search_terms = [
                    "concurso docente Entre Ríos",
                    "convocatoria docente Concepción",
                    "cargo educativo Paraná",
                    "llamado a concurso Entre Ríos",
                    "vacante docente Entre Ríos",
                    "concurso magisterio Entre Ríos",
                ]
                
                # Explorar URLs específicas primero
                urls_to_visit = specific_urls + education_pages
                
                # Agregar URLs de búsqueda
                for term in search_terms:
                    search_url = f"https://www.facebook.com/search/top/?q={term.replace(' ', '%20')}"
                    urls_to_visit.append(search_url)
                
                while urls_to_visit and (limit is None or len(contests) < limit):
                    current_url = urls_to_visit.pop(0)
                    
                    if current_url in visited_urls:
                        continue
                    
                    visited_urls.add(current_url)
                    print(f"Explorando Facebook: {current_url}")
                    
                    try:
                        async with session.get(current_url, timeout=15) as response:
                            if response.status != 200:
                                print(f"URL no disponible: {current_url} - Status: {response.status}")
                                continue
                            
                            html = await response.text()
                            soup = BeautifulSoup(html, 'html.parser')
                            
                            # Buscar concursos en esta página
                            contest_info = self._extract_contest_info(soup, current_url)
                            if contest_info:
                                # Verificar si ya tenemos este concurso
                                if not any(c.title == contest_info.title for c in contests):
                                    contests.append(contest_info)
                                    print(f"Concurso encontrado en Facebook: {contest_info.title}")
                            
                            # Encontrar más enlaces relevantes
                            new_links = self._find_facebook_links(soup, current_url, visited_urls)
                            urls_to_visit.extend(new_links)
                            
                            # Limitar para no sobrecargar
                            if len(visited_urls) > 30:
                                print("Límite de páginas Facebook alcanzado, deteniendo exploración")
                                break
                                
                            # Pequeña pausa entre requests
                            await asyncio.sleep(2)
                                
                    except Exception as e:
                        print(f"Error explorando {current_url}: {e}")
                        continue
        
        except Exception as e:
            print(f"Error general en scraping Facebook: {e}")
        
        print(f"Exploración Facebook completada. Total concursos encontrados: {len(contests)}")
        return contests
    
    def _find_facebook_links(self, soup: BeautifulSoup, base_url: str, visited_urls: set) -> List[str]:
        """Encontrar enlaces relevantes en Facebook"""
        links = []
        
        # Palabras clave que indican concursos en Facebook
        contest_keywords = [
            'concurso', 'convocatoria', 'llamado', 'cargo', 'puesto', 'docente',
            'profesor', 'maestro', 'educación', 'escuela', 'instituto', 'colegio',
            'secundaria', 'primaria', 'inicial', 'jardín', 'cátedra', 'materia',
            'horas', 'carga horaria', 'suplente', 'titular', 'interino',
            'contratado', 'temporal', 'reemplazo', 'designación', 'nombramiento',
            'selección', 'antecedentes', 'oposición', 'concurso docente'
        ]
        
        # Buscar todos los enlaces
        all_links = soup.find_all('a', href=True)
        
        for link in all_links:
            href = link.get('href', '')
            text = link.get_text().lower()
            
            # Construir URL completa
            if href.startswith('/'):
                full_url = urljoin(base_url, href)
            elif href.startswith('http'):
                full_url = href
            else:
                continue
            
            # Solo URLs de Facebook
            if 'facebook.com' not in full_url:
                continue
            
            # Evitar URLs ya visitadas
            if full_url in visited_urls or full_url in links:
                continue
            
            # Evitar archivos no HTML
            if any(ext in full_url.lower() for ext in ['.pdf', '.jpg', '.png', '.zip']):
                continue
            
            # Evitar enlaces de configuración, login, etc.
            if any(skip in full_url.lower() for skip in ['login', 'settings', 'help', 'about', 'privacy']):
                continue
            
            # Buscar palabras clave en texto o URL
            combined_text = text + ' ' + href.lower()
            
            # Si contiene palabras clave de concursos
            if any(keyword in combined_text for keyword in contest_keywords):
                links.append(full_url)
                print(f"Enlace de concurso Facebook encontrado: {full_url}")
            
            # Si es un post o página relevante
            elif any(pattern in full_url for pattern in ['/posts/', '/share/p/', '/pages/']):
                links.append(full_url)
                print(f"Post/página Facebook encontrado: {full_url}")
        
        return list(set(links))  # Eliminar duplicados
    
    def _extract_contest_info(self, soup: BeautifulSoup, source_url: str) -> Optional[ScrapedContest]:
        """Extraer información de un concurso de Facebook - versión mejorada"""
        try:
            # Buscar título en Facebook (varios selectores posibles)
            title_selectors = [
                'h1', 'h2', 'h3',
                '[data-testid="story-subtitle"]',
                '[role="heading"]',
                '.uiIntelligentFormTitle',
                '.fbPageBannerHeader',
                '[data-hover="tooltip"]',
                '.x1heor9g',
                '.x1lliihq'
            ]
            
            title = ""
            for selector in title_selectors:
                title_elem = soup.select_one(selector)
                if title_elem:
                    title = self.normalize_text(title_elem.get_text())
                    # Verificar si el título parece ser de un concurso
                    if any(keyword in title.lower() for keyword in ['convocatoria', 'concurso', 'llamado', 'cargo', 'vacante']):
                        break
                    else:
                        title = ""
            
            if not title:
                # Si no hay título claro, buscar en el contenido
                content_text = soup.get_text()
                if not any(keyword in content_text.lower() for keyword in ['convocatoria', 'concurso', 'llamado', 'cargo', 'vacante']):
                    return None
                
                # Usar el título de la página como último recurso
                title_tag = soup.find('title')
                if title_tag:
                    title = self.normalize_text(title_tag.get_text())
                else:
                    return None
            
            # Extraer descripción del contenido principal
            desc_selectors = [
                '[data-testid="story-subtitle"]',
                '[role="heading"] + p',
                '.uiIntelligentFormTitle + div',
                '.fbPageBannerHeader + div',
                'div[data-testid="story-subtitle"] + div',
                '.x1y332i5',
                '.x1pi30zi',
                '.x6s0dn4'
            ]
            
            description = ""
            for selector in desc_selectors:
                desc_elem = soup.select_one(selector)
                if desc_elem:
                    desc_text = self.normalize_text(desc_elem.get_text())
                    if len(desc_text) > 50:  # Descripción significativa
                        description = desc_text[:500] + "..." if len(desc_text) > 500 else desc_text
                        break
            
            # Si no hay descripción, usar el primer párrafo significativo
            if not description:
                paragraphs = soup.find_all('p')
                for p in paragraphs:
                    text = self.normalize_text(p.get_text())
                    if len(text) > 30:
                        description = text[:300] + "..." if len(text) > 300 else text
                        break
            
            # Extraer información del concurso del texto completo
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
            school_info = self._extract_school_info(text_content, source_url)
            
            # Extraer materia
            subject = self._extract_subject(title + " " + description)
            
            return ScrapedContest(
                title=title,
                description=description,
                date=date,
                registration_deadline=deadline,
                school_name=school_info['name'],
                school_city=school_info['city'],
                school_department=school_info['department'],
                school_address=school_info['address'],
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
            print(f"Error extracting contest info from Facebook: {e}")
            return None
    
    def _extract_school_info(self, text: str, source_url: str) -> dict:
        """Extraer información de la escuela para Facebook"""
        # Ciudades de Entre Ríos comunes
        cities = [
            'paraná', 'concepción', 'uruguay', 'gualeguaychú', 'concordia',
            'villaguay', 'chajarí', 'federación', 'la paz', 'nogoyá',
            'maría', 'crespo', 'victoria', 'gualeguay', 'feliciano',
            'san josé de feliciano', 'hasenkamp', 'hernandarias', 'ibicuy',
            'libertador san martín', 'colon', 'sanz peña', 'rosario del tala'
        ]
        
        # Buscar patrones de escuelas
        school_patterns = [
            r'escuela\s+([^\s,\.]+(?:\s+[Nn]°\s*\d+)?(?:\s+[^\s,\.]+)*)',
            r'esc\.\s*([^\s,\.]+(?:\s+[Nn]°\s*\d+)?(?:\s+[^\s,\.]+)*)',
            r'instituto\s+([^\s,\.]+(?:\s+[^\s,\.]+)*)',
            r'colegio\s+([^\s,\.]+(?:\s+[^\s,\.]+)*)',
            r'([A-Z][a-záéíóúñ\s]+[Nn]°\s*\d+)',
            r'([A-Z][a-záéíóúñ]+\s+[Nn]°\s*\d+)'
        ]
        
        school_name = None
        for pattern in school_patterns:
            match = re.search(pattern, text)
            if match:
                school_name = match.group(1).strip()
                break
        
        # Si no encontramos escuela, usar genérico
        if not school_name:
            school_name = "Escuela Pública"
        
        # Limitar longitud para evitar error de base de datos
        if len(school_name) > 100:
            school_name = school_name[:97] + "..."
        
        # Extraer ciudad
        city = "Concepción"  # Default
        text_lower = text.lower()
        for city_name in cities:
            if city_name in text_lower:
                city = city_name.title()
                break
        
        # Extraer departamento basado en la ciudad
        departments = {
            'paraná': 'Paraná',
            'concepción': 'Concepción',
            'uruguay': 'Uruguay',
            'gualeguaychú': 'Gualeguaychú',
            'concordia': 'Concordia',
            'villaguay': 'Villaguay',
            'colon': 'Colón',
            'federación': 'Federación'
        }
        
        department = departments.get(city.lower(), 'Concepción')
        
        # Extraer dirección si existe
        address_patterns = [
            r'([A-Z][a-záéíóúñ\s]+\s+\d+)',
            r'([A-Z][a-záéíóúñ\s]+\s+\d+\s*[A-Z][a-záéíóúñ\s]*)',
            r'(calle\s+[^\s,\.]+\s+\d+)'
        ]
        
        address = None
        for pattern in address_patterns:
            match = re.search(pattern, text)
            if match:
                address = match.group(1).strip()
                break
        
        return {
            'name': school_name,
            'city': city,
            'department': department,
            'address': address
        }
    
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
            r'(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})',
            r'(\d{1,2}:\d{2}\s*a\s*\d{1,2}:\d{2})',
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
    
    def _create_manual_contest_from_url(self, url: str) -> Optional[ScrapedContest]:
        """Crear un concurso manualmente desde una URL de Facebook cuando el scraping falla"""
        try:
            # Extraer información de la URL
            url_parts = url.split('/')
            
            # Detectar si es la página específica de islas del ibicuy
            if "ddeislasdelibicuy" in url.lower():
                title = "Concursos DDE Islas del Ibicuy - Facebook"
                description = f"Concursos y convocatorias publicados por la Dirección de Educación de Islas del Ibicuy.\n\nURL: {url}\n\nNota: Se encontraron múltiples publicaciones en la última semana. Por favor visite la página de Facebook para ver todos los concursos disponibles: https://www.facebook.com/ddeislasdelibicuy"
                school_name = "Dirección de Educación de Islas del Ibicuy"
                school_city = "Islas del Ibicuy"
                school_department = "Islas del Ibicuy"
            
            # Detectar si es una DDE (Dirección de Educación)
            elif "dde" in url.lower():
                # Extraer el nombre de la DDE
                dde_name = url.split('/')[-1] if url.split('/')[-1] else "DDE"
                title = f"Concursos DDE {dde_name.title()} - Facebook"
                description = f"Concursos y convocatorias publicados por la Dirección de Educación de {dde_name.title()}.\n\nURL: {url}\n\nNota: Esta página de Facebook publica regularmente concursos y convocatorias docentes. Por favor visite la página para ver todas las publicaciones recientes."
                
                # Mapear DDEs a ciudades conocidas
                dde_cities = {
                    'ddeparana': 'Paraná',
                    'ddeconcepcion': 'Concepción del Uruguay',
                    'ddeuruguay': 'Uruguay',
                    'ddegualeguaychu': 'Gualeguaychú',
                    'ddeconcordia': 'Concordia',
                    'ddevillaguay': 'Villaguay',
                }
                
                return ScrapedContest(
                    title=title,
                    description=description,
                    date=datetime.now(),
                    registration_deadline=None,
                    school_name=school_name,
                    school_city=school_city,
                    school_department=school_department,
                    subject=self._extract_subject_from_title(title),
                    level="Todos",
                    source_url=url,
                    publication_link=self._extract_publication_link(url),
                    source_name=self.name
                )
                
        except Exception as e:
            print(f"Error creando concurso manual desde URL {url}: {e}")
            return None
    
    def _extract_publication_link(self, facebook_url: str) -> str:
        """Extraer el link de la publicación original si existe"""
        try:
            # Para posts de Facebook share, el link de publicación es el mismo
            if "share/p/" in facebook_url:
                return facebook_url
            elif "posts/" in facebook_url:
                # Es un post directo, extraer el ID
                post_id = facebook_url.split("posts/")[1].split("/")[0]
                return f"https://www.facebook.com/posts/{post_id}"
            elif "permalink.php" in facebook_url:
                # Es un permalink
                return facebook_url
            else:
                # Para otros casos, devolver el URL original
                return facebook_url
        except Exception:
            return facebook_url
    
    def _extract_dde_name_from_url(self, url: str) -> str:
        """Extraer nombre del DDE desde URL"""
        try:
            if "dde" in url.lower():
                # Buscar el nombre del DDE después de 'dde'
                parts = url.split("/")
                for i, part in enumerate(parts):
                    if "dde" in part.lower() and i + 1 < len(parts):
                        return parts[i + 1].replace("-", " ").title()
            return "General"
        except Exception:
            return "General"
    
    async def is_available(self) -> bool:
        """Check if the scraper source is available"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            async with aiohttp.ClientSession(headers=headers) as session:
                async with session.get(self.base_url, timeout=5) as response:
                    return response.status == 200
        except:
            return False
