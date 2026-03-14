"""
Scrapers para Capacitaciones y Cursos
"""

import aiohttp
import asyncio
from bs4 import BeautifulSoup
from datetime import datetime
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin, urlparse

from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest, ScrapedDiploma
from app.infrastructure.scrapers.pattern_learning import PatternLearning


class ScrapedCapacitacion:
    """Modelo para datos de capacitaciones scrapeadas"""
    def __init__(self):
        self.titulo = ""
        self.descripcion = ""
        self.institucion = ""
        self.modalidad = ""
        self.duracion = ""
        self.fecha_inicio = None
        self.fecha_fin = None
        self.fecha_limite_inscripcion = None
        self.precio = None
        self.moneda = "ARS"
        self.beca_disponible = False
        self.puntaje_asignado = None
        self.tipo_certificado = ""
        self.horas_catedra = None
        self.url_inscripcion = ""
        self.email_contacto = ""
        self.telefono_contacto = ""
        self.provincia = "Entre Ríos"
        self.ciudad = ""
        self.direccion = ""
        self.nivel_educativo = ""
        self.destinatarios = ""
        self.fuente = ""
        self.url_fuente = ""
        self.requisitos = []


class AmetCapacitacionesScraper(BaseScraper):
    """Scraper para capacitaciones del sitio de AMET"""
    
    def __init__(self):
        super().__init__("AMET Capacitaciones", "https://ametentrerios.com")
        self.capacitaciones_url = f"{self.base_url}/capacitaciones/"
    
    async def is_available(self) -> bool:
        """Verificar si el sitio está disponible"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.capacitaciones_url, timeout=5) as response:
                    return response.status == 200
        except:
            return False
    
    async def scrape_capacitaciones(self) -> List[ScrapedCapacitacion]:
        """Extraer capacitaciones del sitio de AMET"""
        capacitaciones = []
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.capacitaciones_url) as response:
                    if response.status != 200:
                        return []
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Buscar artículos de capacitaciones
                    articles = soup.find_all('article') or soup.find_all('div', class_='post')
                    
                    for article in articles:
                        capacitacion = self._parse_capacitacion_article(article)
                        if capacitacion:
                            capacitaciones.append(capacitacion)
        
        except Exception as e:
            print(f"Error scraping AMET capacitaciones: {e}")
        
        return capacitaciones
    
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """Extraer concursos y capacitaciones del sitio de AMET - versión optimizada"""
        contests = []
        
        try:
            # Headers para simular navegador real
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
                'Connection': 'keep-alive',
                'Timeout': '10',
            }
            
            # Timeout corto para evitar que se quede colgado
            timeout = aiohttp.ClientTimeout(total=10, connect=5)
            
            async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
                print(f"Intentando acceder a AMET: {self.capacitaciones_url}")
                
                try:
                    async with session.get(self.capacitaciones_url) as response:
                        if response.status != 200:
                            print(f"AMET no disponible - Status: {response.status}")
                            return contests
                        
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Buscar rápidamente artículos relevantes
                        articles = soup.find_all('article') or soup.find_all('div', class_='post')
                        
                        print(f"Encontrados {len(articles)} artículos en AMET")
                        
                        for i, article in enumerate(articles):
                            if limit and len(contests) >= limit:
                                break
                            
                            contest = self._parse_article_as_contest(article)
                            if contest:
                                contests.append(contest)
                                print(f"Concurso/capacitación {i+1} encontrado en AMET: {contest.title}")
                
                except asyncio.TimeoutError:
                    print("Timeout al acceder a AMET - creando concurso manual")
                    # Crear un concurso manual si el sitio está lento
                    manual_contest = self._create_manual_amet_contest()
                    if manual_contest:
                        contests.append(manual_contest)
                except Exception as e:
                    print(f"Error específico en AMET: {e}")
                    # Crear concurso manual como fallback
                    manual_contest = self._create_manual_amet_contest()
                    if manual_contest:
                        contests.append(manual_contest)
        
        except Exception as e:
            print(f"Error general scraping AMET: {e}")
            # Si todo falla, crear un concurso manual
            manual_contest = self._create_manual_amet_contest()
            if manual_contest:
                contests.append(manual_contest)
        
        print(f"Exploración AMET completada. Total encontrados: {len(contests)}")
        return contests
    
    async def scrape_diplomas(self, limit: Optional[int] = None) -> List[ScrapedDiploma]:
        """Extraer diplomaturas y capacitaciones del sitio de AMET"""
        diplomas = []
        
        try:
            # Headers para simular navegador real
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
                'Connection': 'keep-alive',
                'Timeout': '10',
            }
            
            # Timeout corto para evitar que se quede colgado
            timeout = aiohttp.ClientTimeout(total=10, connect=5)
            
            async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
                print(f"Intentando acceder a AMET para diplomaturas: {self.capacitaciones_url}")
                
                try:
                    async with session.get(self.capacitaciones_url) as response:
                        if response.status != 200:
                            print(f"AMET no disponible - Status: {response.status}")
                            return diplomas
                        
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Buscar rápidamente artículos relevantes
                        articles = soup.find_all('article') or soup.find_all('div', class_='post')
                        
                        print(f"Encontrados {len(articles)} artículos en AMET para diplomaturas")
                        
                        for i, article in enumerate(articles):
                            if limit and len(diplomas) >= limit:
                                break
                            
                            diploma = self._parse_article_as_diploma(article)
                            if diploma:
                                diplomas.append(diploma)
                                print(f"Diplomatura {i+1} encontrada en AMET: {diploma.title}")
                
                except asyncio.TimeoutError:
                    print("Timeout al acceder a AMET para diplomaturas - creando diplomatura manual")
                    # Crear una diplomatura manual si el sitio está lento
                    manual_diploma = self._create_manual_amet_diploma()
                    if manual_diploma:
                        diplomas.append(manual_diploma)
                except Exception as e:
                    print(f"Error específico en AMET para diplomaturas: {e}")
                    # Crear diplomatura manual como fallback
                    manual_diploma = self._create_manual_amet_diploma()
                    if manual_diploma:
                        diplomas.append(manual_diploma)
        
        except Exception as e:
            print(f"Error general scraping AMET diplomaturas: {e}")
            # Si todo falla, crear una diplomatura manual
            manual_diploma = self._create_manual_amet_diploma()
            if manual_diploma:
                diplomas.append(manual_diploma)
        
        print(f"Exploración AMET diplomaturas completada. Total encontrados: {len(diplomas)}")
        return diplomas
    
    def _parse_article_as_diploma(self, article) -> Optional[ScrapedDiploma]:
        """Parsear un artículo como diplomatura/capacitación"""
        try:
            # Extraer título
            title_elem = article.find('h1') or article.find('h2') or article.find('h3') or article.find('title')
            if not title_elem:
                return None
            
            title = self.normalize_text(title_elem.get_text())
            if not title or len(title) < 10:
                return None
            
            # Verificar si es relevante (diplomaturas, capacitaciones, etc.)
            title_lower = title.lower()
            relevant_keywords = [
                'diplomatura', 'capacitación', 'curso', 'taller', 'jornada', 'seminario', 'formación', 'posgrado',
                'actualización', 'perfeccionamiento', 'especialización', 'maestría', 'certificación',
                'entrenamiento', 'habilidades', 'competencias', 'desarrollo', 'profesional',
                'docente', 'educativo', 'pedagógico', 'didáctico', 'metodológico',
                'tecnología', 'digital', 'virtual', 'online', 'remoto', 'a distancia',
                'inclusión', 'diversidad', 'integración', 'necesidades educativas',
                'matemática', 'lengua', 'ciencias', 'historia', 'geografía', 'arte',
                'educación física', 'música', 'plástica', 'informática', 'inglés'
            ]
            if not any(keyword in title_lower for keyword in relevant_keywords):
                return None
            
            # Extraer descripción
            desc_elem = article.find('p') or article.find('div', class_='content')
            description = ""
            if desc_elem:
                description = self.normalize_text(desc_elem.get_text())
                description = description[:500] + "..." if len(description) > 500 else description
            
            # Extraer información del artículo
            text_content = article.get_text()
            text_lower = text_content.lower()
            
            # Extraer información específica de diplomaturas
            modality = self._extract_modality(text_lower)
            duration = self._extract_duration(text_lower)
            start_date = self._extract_date(text_content)
            price = self._extract_price(text_lower)
            target_audience = self._extract_target_audience(text_lower)
            level = self._extract_level(text_lower)
            
            # Extraer información de institución
            institution_info = self._extract_institution_info(text_content)
            
            # Extraer contacto
            contact_info = self._extract_contact_info(text_content)
            
            return ScrapedDiploma(
                title=title,
                description=description,
                modality=modality,
                duration=duration,
                start_date=start_date,
                end_date=None,
                registration_deadline=self._extract_deadline(text_content),
                target_audience=target_audience,
                level=level,
                price=price,
                currency="ARS",
                has_scholarship=self._extract_scholarship(text_lower),
                scholarship_info=self._extract_scholarship_info(text_lower),
                institution_name=institution_info['name'],
                institution_city=institution_info['city'],
                institution_department=institution_info['department'],
                institution_address=institution_info['address'],
                contact_email=contact_info['email'],
                contact_phone=contact_info['phone'],
                contact_website=contact_info['website'],
                source_url=self.capacitaciones_url,
                source_name=self.name
            )
            
        except Exception as e:
            print(f"Error parsing article as diploma: {e}")
            return None
    
    def _extract_modality(self, text: str) -> Optional[str]:
        """Extraer modalidad (virtual, presencial, semipresencial)"""
        if 'virtual' in text or 'online' in text or 'remoto' in text:
            return "Virtual"
        elif 'presencial' in text:
            return "Presencial"
        elif 'semipresencial' in text or 'hibrido' in text:
            return "Semipresencial"
        return None
    
    def _extract_duration(self, text: str) -> Optional[str]:
        """Extraer duración"""
        import re
        patterns = [
            r'(\d+)\s*meses?',
            r'(\d+)\s*años?',
            r'(\d+)\s*semanas?',
            r'(\d+)\s*días?',
            r'(\d+)\s*horas?',
            r'(\d+)\s*hs\.?',
            r'(\d+)\s*h\s*cátedras?'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0)
        return None
    
    def _extract_price(self, text: str) -> Optional[int]:
        """Extraer precio"""
        import re
        if 'gratis' in text or 'sin cargo' in text or 'gratuito' in text:
            return 0
        
        price_match = re.search(r'\$(\d+(?:\.\d+)?)', text)
        if price_match:
            try:
                return int(float(price_match.group(1)))
            except ValueError:
                pass
        return None
    
    def _extract_target_audience(self, text: str) -> Optional[str]:
        """Extraer audiencia objetivo"""
        audiences = ['docentes', 'directivos', 'supervisores', 'estudiantes', 'profesionales', 'egresados']
        text_lower = text.lower()
        
        for audience in audiences:
            if audience in text_lower:
                return audience.title()
        return None
    
    def _extract_scholarship(self, text: str) -> bool:
        """Extraer si tiene becas"""
        scholarship_keywords = ['beca', 'becario', 'descuento', 'financiamiento', 'cuotas']
        return any(keyword in text for keyword in scholarship_keywords)
    
    def _extract_scholarship_info(self, text: str) -> Optional[str]:
        """Extraer información de becas"""
        import re
        scholarship_patterns = [
            r'beca[:\s]*(.+?)(?:\.|$)',
            r'descuento[:\s]*(.+?)(?:\.|$)',
            r'cuotas[:\s]*(.+?)(?:\.|$)'
        ]
        
        for pattern in scholarship_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
    
    def _extract_institution_info(self, text: str) -> dict:
        """Extraer información de institución"""
        institutions = [
            'AMET', 'Asociación Magisterial de Entre Ríos', 'Ministerio de Educación',
            'Consejo General de Educación', 'Dirección General de Escuelas'
        ]
        
        institution_name = "AMET - Asociación Magisterial de Entre Ríos"
        for institution in institutions:
            if institution.lower() in text.lower():
                institution_name = institution
                break
        
        return {
            'name': institution_name,
            'city': 'Paraná',
            'department': 'Paraná',
            'address': None
        }
    
    def _extract_contact_info(self, text: str) -> dict:
        """Extraer información de contacto"""
        import re
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
        phone_match = re.search(r'(\d{2,4}[-\s]?\d{4,8})', text)
        website_match = re.search(r'https?://[^\s]+', text)
        
        return {
            'email': email_match.group(0) if email_match else None,
            'phone': phone_match.group(0) if phone_match else None,
            'website': website_match.group(0) if website_match else None
        }
    
    def _create_manual_amet_diploma(self) -> Optional[ScrapedDiploma]:
        """Crear una diplomatura manual para AMET cuando el scraping falla"""
        try:
            return ScrapedDiploma(
                title="Capacitaciones AMET - Requerida Revisión Manual",
                description=f"Capacitaciones y diplomaturas disponibles en AMET (Asociación Magisterial de Entre Ríos).\n\nURL: {self.capacitaciones_url}\n\nNota: Por favor visite el sitio directamente para ver las capacitaciones disponibles, ya que el acceso automatizado puede ser lento o bloqueado.",
                modality="No especificada",
                duration="No especificada",
                start_date=datetime.now(),
                end_date=None,
                registration_deadline=None,
                target_audience="Docentes",
                level="General",
                price=None,
                currency="ARS",
                has_scholarship=False,
                scholarship_info=None,
                institution_name="AMET - Asociación Magisterial de Entre Ríos",
                institution_city="Paraná",
                institution_department="Paraná",
                institution_address=None,
                contact_email=None,
                contact_phone=None,
                contact_website=self.capacitaciones_url,
                source_url=self.capacitaciones_url,
                source_name=self.name
            )
        except Exception as e:
            print(f"Error creating manual AMET diploma: {e}")
            return None
    
    def _create_manual_amet_contest(self) -> Optional[ScrapedContest]:
        """Crear un concurso manual para AMET cuando el scraping falla"""
        try:
            return ScrapedContest(
                title="Capacitaciones AMET - Requerida Revisión Manual",
                description=f"Capacitaciones y concursos disponibles en AMET (Asociación Magisterial de Entre Ríos).\n\nURL: {self.capacitaciones_url}\n\nNota: Por favor visite el sitio directamente para ver las capacitaciones disponibles, ya que el acceso automatizado puede ser lento o bloqueado.",
                date=datetime.now(),
                registration_deadline=None,
                school_name="AMET - Asociación Magisterial de Entre Ríos",
                school_city="Paraná",
                school_department="Paraná",
                school_address=None,
                subject_name="Capacitación Docente",
                source_url=self.capacitaciones_url,
                source_name=self.name,
                level="General",
                shift=None,
                schedule=None,
                hours_to_cover=None,
                contract_type=None
            )
        except Exception as e:
            print(f"Error creating manual AMET contest: {e}")
            return None
    
    def _parse_capacitacion_article(self, article) -> ScrapedCapacitacion:
        """Parsear un artículo de capacitación"""
        capacitacion = ScrapedCapacitacion()
        capacitacion.fuente = self.name
        capacitacion.url_fuente = self.capacitaciones_url
        
        # Extraer título
        title_elem = article.find('h2') or article.find('h3') or article.find('h1')
        if title_elem:
            capacitacion.titulo = title_elem.get_text(strip=True)
        
        # Extraer enlace
        link_elem = article.find('a')
        if link_elem and link_elem.get('href'):
            capacitacion.url_inscripcion = urljoin(self.base_url, link_elem['href'])
        
        # Extraer descripción
        content_elem = article.find('div', class_='entry-content') or article.find('div', class_='post-content')
        if content_elem:
            capacitacion.descripcion = content_elem.get_text(strip=True, separator=' ')[:500]
        
        # Extraer fecha
        date_elem = article.find('time') or article.find('span', class_='date')
        if date_elem:
            capacitacion.fecha_inicio = self._parse_date(date_elem.get_text(strip=True))
        
        # Extraer institución
        capacitacion.institucion = "AMET Entre Ríos"
        
        # Buscar información de precio
        price_text = article.get_text().lower()
        if 'gratis' in price_text or 'free' in price_text:
            capacitacion.precio = 0
        elif '$' in price_text:
            capacitacion.precio = self._extract_price(price_text)
        
        # Buscar información de modalidad
        if 'virtual' in price_text or 'online' in price_text:
            capacitacion.modalidad = "Virtual"
        elif 'presencial' in price_text:
            capacitacion.modalidad = "Presencial"
        
        return capacitacion if capacitacion.titulo else None
    
    def _parse_date(self, date_text: str) -> datetime:
        """Parsear fecha de texto"""
        try:
            # Implementar parsing de fechas según formato del sitio
            return datetime.now()  # Placeholder
        except:
            return None
    
    def _extract_price(self, text: str) -> float:
        """Extraer precio del texto"""
        try:
            import re
            price_match = re.search(r'\$(\d+(?:\.\d+)*)', text)
            if price_match:
                return float(price_match.group(1))
        except:
            pass
        return None


class IsfdCapacitacionesScraper(BaseScraper):
    """Scraper para capacitaciones de ISFD"""
    
    def __init__(self):
        super().__init__("ISFD Capacitaciones", "https://ensmm-ers.infd.edu.ar")
    
    async def is_available(self) -> bool:
        """Verificar si el sitio está disponible"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, timeout=5) as response:
                    return response.status == 200
        except:
            return False
    
    async def scrape_capacitaciones(self) -> List[ScrapedCapacitacion]:
        """Extraer capacitaciones de ISFD"""
        capacitaciones = []
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url) as response:
                    if response.status != 200:
                        return []
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Buscar enlaces a capacitaciones
                    links = soup.find_all('a', href=True)
                    
                    for link in links:
                        href = link['href']
                        if any(keyword in href.lower() for keyword in ['capacitacion', 'curso', 'taller', 'formacion']):
                            full_url = urljoin(self.base_url, href)
                            capacitacion = await self._scrape_capacitacion_page(session, full_url)
                            if capacitacion:
                                capacitaciones.append(capacitacion)
        
        except Exception as e:
            print(f"Error scraping ISFD capacitaciones: {e}")
        
        return capacitaciones
    
    async def _scrape_capacitacion_page(self, session, url: str) -> ScrapedCapacitacion:
        """Scrapear página individual de capacitación"""
        try:
            async with session.get(url) as response:
                if response.status != 200:
                    return None
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                capacitacion = ScrapedCapacitacion()
                capacitacion.fuente = self.name
                capacitacion.url_fuente = url
                capacitacion.institucion = "ISFD Entre Ríos"
                
                # Extraer título
                title_elem = soup.find('h1') or soup.find('title')
                if title_elem:
                    capacitacion.titulo = title_elem.get_text(strip=True)
                
                # Extraer contenido
                content = soup.get_text(strip=True, separator=' ')
                capacitacion.descripcion = content[:500]
                
                # Buscar información específica
                capacitacion = self._extract_capacitacion_info(capacitacion, content)
                
                return capacitacion if capacitacion.titulo else None
        
        except Exception as e:
            print(f"Error scraping capacitación page {url}: {e}")
            return None
    
    def _extract_capacitacion_info(self, capacitacion: ScrapedCapacitacion, content: str) -> ScrapedCapacitacion:
        """Extraer información específica de capacitación"""
        content_lower = content.lower()
        
        # Buscar duración
        import re
        duration_match = re.search(r'(\d+)\s*(horas|hs|días|meses)', content_lower)
        if duration_match:
            capacitacion.duracion = duration_match.group(0)
        
        # Buscar modalidad
        if 'virtual' in content_lower or 'online' in content_lower:
            capacitacion.modalidad = "Virtual"
        elif 'presencial' in content_lower:
            capacitacion.modalidad = "Presencial"
        
        # Buscar precio
        if 'gratis' in content_lower or 'sin cargo' in content_lower:
            capacitacion.precio = 0
        elif '$' in content:
            price_match = re.search(r'\$(\d+(?:\.\d+)*)', content)
            if price_match:
                capacitacion.precio = float(price_match.group(1))
        
        # Buscar puntaje
        puntaje_match = re.search(r'puntaje[:\s]*(\d+(?:\.\d+)?)', content_lower)
        if puntaje_match:
            capacitacion.puntaje_asignado = float(puntaje_match.group(1))
        
        # Buscar contacto
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', content)
        if email_match:
            capacitacion.email_contacto = email_match.group(0)
        
        return capacitacion


class CapacitacionesScraperFactory:
    """Factory para scrapers de capacitaciones"""
    
    def __init__(self):
        self.scrapers = {
            "amet_capacitaciones": AmetCapacitacionesScraper(),
            "isfd_capacitaciones": IsfdCapacitacionesScraper(),
        }
    
    def create_scraper(self, source_name: str):
        """Crear scraper específico"""
        if source_name in self.scrapers:
            return self.scrapers[source_name]
        raise ValueError(f"Unknown capacitaciones scraper: {source_name}")
    
    def get_available_scrapers(self) -> Dict[str, Any]:
        """Obtener todos los scrapers disponibles"""
        return self.scrapers
    
    async def scrape_all_capacitaciones(self) -> List[ScrapedCapacitacion]:
        """Scrapear todas las capacitaciones de todas las fuentes"""
        all_capacitaciones = []
        
        tasks = []
        for scraper in self.scrapers.values():
            if await scraper.is_available():
                tasks.append(scraper.scrape_capacitaciones())
        
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for result in results:
                if isinstance(result, list):
                    all_capacitaciones.extend(result)
                else:
                    print(f"Error in scraper: {result}")
        
        return all_capacitations
    
    def _parse_article_as_contest(self, article) -> Optional[ScrapedContest]:
        """Parsear un artículo como concurso/capacitación"""
        try:
            # Extraer título
            title_elem = article.find('h1') or article.find('h2') or article.find('h3') or article.find('title')
            if not title_elem:
                return None
            
            title = self.normalize_text(title_elem.get_text())
            if not title or len(title) < 10:
                return None
            
            # Verificar si es relevante (concursos, capacitaciones, etc.)
            title_lower = title.lower()
            relevant_keywords = ['concurso', 'convocatoria', 'capacitación', 'curso', 'taller', 'jornada', 'seminario', 'formación']
            if not any(keyword in title_lower for keyword in relevant_keywords):
                return None
            
            # Extraer descripción
            desc_elem = article.find('p') or article.find('div', class_='content')
            description = ""
            if desc_elem:
                description = self.normalize_text(desc_elem.get_text())
                description = description[:500] + "..." if len(description) > 500 else description
            
            # Extraer información del artículo
            text_content = article.get_text()
            
            # Extraer fecha
            date = self._extract_date(text_content)
            
            # Extraer información de institución
            school_info = self._extract_school_info(text_content)
            
            return ScrapedContest(
                title=title,
                description=description,
                date=date,
                registration_deadline=self._extract_deadline(text_content),
                school_name=school_info['name'],
                school_city=school_info['city'],
                school_department=school_info['department'],
                school_address=school_info['address'],
                subject_name=self._extract_subject(title + " " + description),
                source_url=self.capacitaciones_url,
                source_name=self.name,
                level=self._extract_level(text_content),
                shift=self._extract_shift(text_content),
                schedule=self._extract_schedule(text_content),
                hours_to_cover=self._extract_hours(text_content),
                contract_type=self._extract_contract_type(text_content)
            )
            
        except Exception as e:
            print(f"Error parsing article as contest: {e}")
            return None
    
    def _extract_school_info(self, text: str) -> dict:
        """Extraer información de institución"""
        # Buscar nombres de instituciones comunes en Entre Ríos
        institutions = [
            'AMET', 'Asociación Magisterial de Entre Ríos', 'Ministerio de Educación',
            'Consejo General de Educación', 'Dirección General de Escuelas'
        ]
        
        school_name = "Institución Educativa"
        for institution in institutions:
            if institution.lower() in text.lower():
                school_name = institution
                break
        
        return {
            'name': school_name,
            'city': 'Paraná',
            'department': 'Paraná',
            'address': None
        }
    
    def _extract_level(self, text: str) -> str:
        """Extraer nivel educativo"""
        levels = ['inicial', 'primaria', 'secundaria', 'jardín', 'superior', 'terciario']
        text_lower = text.lower()
        
        for level in levels:
            if level in text_lower:
                return level.title()
        return "General"
    
    def _extract_shift(self, text: str) -> str:
        """Extraer turno"""
        shifts = ['mañana', 'tarde', 'jornada completa', 'vespertina', 'nocturna']
        text_lower = text.lower()
        
        for shift in shifts:
            if shift in text_lower:
                return shift.title()
        return None
    
    def _extract_schedule(self, text: str) -> str:
        """Extraer horarios"""
        import re
        schedule_patterns = [
            r'(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})',
            r'(\d{1,2}:\d{2}\s*a\s*\d{1,2}:\d{2})',
        ]
        
        for pattern in schedule_patterns:
            match = re.search(pattern, text.lower())
            if match:
                return match.group(1)
        return None
    
    def _extract_hours(self, text: str) -> int:
        """Extraer horas"""
        import re
        patterns = [
            r'(\d+)\s*hor[aá]s?',
            r'(\d+)\s*hs\.?',
            r'(\d+)\s*h\s*cátedras?',
            r'(\d+)\s*créditos?'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text.lower())
            if match:
                return int(match.group(1))
        return None
    
    def _extract_contract_type(self, text: str) -> str:
        """Extraer tipo de contrato"""
        contract_types = [
            'titular', 'suplente', 'interino', 'contratado',
            'temporal', 'reemplazo', 'carga horaria'
        ]
        
        text_lower = text.lower()
        for contract in contract_types:
            if contract in text_lower:
                return contract.title()
        return None
    
    def _extract_date(self, text: str) -> datetime:
        """Extraer fecha"""
        import re
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
        
        return datetime.now()
    
    def _extract_deadline(self, text: str) -> datetime:
        """Extraer fecha límite"""
        import re
        deadline_patterns = [
            r'cierre\s*:\s*(\d{1,2})/(\d{1,2})/(\d{4})',
            r'fecha\s+límite\s*:\s*(\d{1,2})/(\d{1,2})/(\d{4})',
            r'inscripción\s*hasta\s*:\s*(\d{1,2})/(\d{1,2})/(\d{4})'
        ]
        
        for pattern in deadline_patterns:
            match = re.search(pattern, text.lower())
            if match:
                day, month, year = match.groups()
                year = int(year)
                
                try:
                    month_names = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
                    month_num = month_names.index(month) + 1 if month in month_names else 1
                    
                    return datetime(year, month_num, int(day))
                except ValueError:
                    continue
        
        return None
    
    def _extract_subject(self, text: str) -> str:
        """Extraer materia/temática"""
        subjects = [
            'matemática', 'lengua', 'historia', 'geografía', 'ciencias naturales',
            'ciencias sociales', 'educación física', 'inglés', 'música', 'plástica',
            'filosofía', 'biología', 'física', 'química', 'informática',
            'literatura', 'castellano', 'educación artística', 'capacitación',
            'formación docente', 'actualización', 'perfeccionamiento'
        ]
        
        text_lower = text.lower()
        for subject in subjects:
            if subject in text_lower:
                return subject.title()
        return "Capacitación"
    
    def normalize_text(self, text: str) -> str:
        """Normalizar texto eliminando espacios extras y caracteres especiales"""
        if not text:
            return ""
        return ' '.join(text.split())
