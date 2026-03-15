"""
Scraper especializado para Islas del Ibicuy - Integra CGE y Facebook
"""

import aiohttp
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import logging

from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest
from app.infrastructure.scrapers.enterios_scraper import EntreriosScraper
from app.infrastructure.scrapers.facebook_scraper import FacebookScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class IslasIbicuyScraper(BaseScraper):
    """Scraper especializado para concursos en Islas del Ibicuy"""
    
    def __init__(self):
        super().__init__(
            name="DDE Islas del Ibicuy - Integrado",
            base_url="https://cge.entrerios.gov.ar"
        )
        
        # Inicializar scrapers componentes
        self.cge_scraper = EntreriosScraper()
        self.facebook_scraper = FacebookScraper()
        
        # URLs específicas de Islas del Ibicuy
        self.islas_urls = [
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-formacion-etica-y-ciudadana-escuela-secundaria-n-3-francisco-ramirez/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-3-francisco-ramirez/",
            "https://cge.entrerios.gov.ar/departamental-islas-del-ibicuy/#concursos-nivel-secundario",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-e-e-t-n-96-conscripto-giorgi-ibicuy-3/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-por-proyecto-escuela-secundaria-n-2-islas-del-ibicuy-villa-paranacito/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-instalaciones-electromecanicas-e-e-t-n-1-augusto-widmann-villa-paranacito/",
            "https://cge.entrerios.gov.ar/2026/03/llamado-a-concurso-llamado-a-concurso-instituto-superior-de-formacion-docente-continua-villa-paranacito-islas/",
            "https://www.facebook.com/ddeislasdelibicuy"
        ]
        
        # Escuelas conocidas de Islas del Ibicuy
        self.escuelas_ibicuy = {
            "Escuela Secundaria N°3 Francisco Ramírez": "Ibicuy",
            "E.E.T.N N°96 Conscripto Giorgi": "Ibicuy", 
            "Escuela Secundaria N°2 Islas del Ibicuy": "Villa Paranacito",
            "E.E.T.N N°1 Augusto Widmann": "Villa Paranacito",
            "Instituto Superior de Formación Docente Continua": "Villa Paranacito"
        }
    
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """Scrape contests específicos de Islas del Ibicuy"""
        logger.info("🏝️ Iniciando scraping especializado para Islas del Ibicuy")
        
        all_contests = []
        
        try:
            # 1. Crear concursos manuales específicos de Islas del Ibicuy
            logger.info("📝 Creando concursos manuales específicos...")
            manual_contests = self._create_islas_manual_contests()
            all_contests.extend(manual_contests)
            logger.info(f"✅ {len(manual_contests)} concursos manuales creados")
            
            # 2. Extraer concursos de las URLs específicas
            logger.info("🌐 Extrayendo concursos de URLs específicas...")
            url_contests = await self._scrape_islas_urls()
            all_contests.extend(url_contests)
            logger.info(f"✅ {len(url_contests)} concursos extraídos de URLs")
            
            # 3. Buscar en Facebook de Islas del Ibicuy
            logger.info("📘 Buscando en Facebook DDE Islas del Ibicuy...")
            facebook_contests = await self._scrape_facebook_islas()
            all_contests.extend(facebook_contests)
            logger.info(f"✅ {len(facebook_contests)} concursos de Facebook")
            
            # 4. Eliminar duplicados
            unique_contests = self._remove_duplicates(all_contests)
            logger.info(f"🔄 Eliminados {len(all_contests) - len(unique_contests)} duplicados")
            
            # 5. Aplicar límite si es necesario
            if limit and len(unique_contests) > limit:
                unique_contests = unique_contests[:limit]
                logger.info(f"📊 Aplicando límite: {limit} concursos")
            
            logger.info(f"🎉 Scraping completado: {len(unique_contests)} concursos únicos de Islas del Ibicuy")
            return unique_contests
            
        except Exception as e:
            logger.error(f"❌ Error en scraping de Islas del Ibicuy: {e}")
            return []
    
    def _create_islas_manual_contests(self) -> List[ScrapedContest]:
        """Crear concursos manuales específicos de Islas del Ibicuy"""
        contests = []
        
        manual_data = [
            {
                "title": "Convocatoria Horas Formación Ética y Ciudadana - Escuela Secundaria N°3 Francisco Ramírez",
                "description": "LLAMADO A CONCURSO - La Rectoría de la Escuela Secundaria N°3 \"Francisco Ramírez\" de la ciudad de Ibicuy convoca a concurso de adjudicación de Horas Cátedras. 2 Hs- FORMACION ÉTICA Y CIUDADANA 3° año \"A\" CBC. STF. Turno Tarde- Días y horarios: Miércoles 14:45 a 16:05 Hs. Fecha: lunes 16 de marzo de 2026 a las 14:30 horas.",
                "url": "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-formacion-etica-y-ciudadana-escuela-secundaria-n-3-francisco-ramirez/",
                "school": "Escuela Secundaria N°3 Francisco Ramírez",
                "city": "Ibicuy",
                "subject": "Formación Ética y Ciudadana",
                "hours": 2,
                "level": "Secundario",
                "shift": "Tarde",
                "schedule": "Miércoles 14:45 a 16:05 Hs",
                "date": datetime(2026, 3, 16, 14, 30)
            },
            {
                "title": "Convocatoria Escuela Secundaria N° 3 Francisco Ramirez - Segundo Llamado",
                "description": "LLAMADO A CONCURSO - La Rectoría de la Escuela Secundaria N°3 \"Francisco Ramírez\" de la ciudad de Ibicuy convoca a concurso de adjudicación de Horas Cátedras. 5 Hs.- MATEMATICA 3° Año \"A\" CBC. STF. Turno Tarde. 2 Hs.- MÚSICA 2° Año \"A\" CBC. SCV. Turno Tarde. 2 Hs.- MÚSICA 3° Año \"A\" CBC. SCV- Turno Tarde. 2 Hs.- MÚSICA 4° Año \"A\" CO. SCV. Turno Tarde. Fecha: lunes 16 de marzo de 2026 a las 15:00 horas.",
                "url": "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-3-francisco-ramirez/",
                "school": "Escuela Secundaria N°3 Francisco Ramírez",
                "city": "Ibicuy",
                "subject": "Múltiples Cátedras",
                "hours": 11,
                "level": "Secundario",
                "shift": "Tarde",
                "date": datetime(2026, 3, 16, 15, 0)
            },
            {
                "title": "Convocatoria E.E.T.N N°96 Conscripto Giorgi - Ibicuy 3",
                "description": "LLAMADO A CONCURSO - E.E.T.N N°96 Conscripto Giorgi de Ibicuy. Concurso para cubrir cargos docentes en la institución. Para más detalles consultar la publicación oficial del CGE.",
                "url": "https://cge.entrerios.gov.ar/2026/03/convocatoria-e-e-t-n-96-conscripto-giorgi-ibicuy-3/",
                "school": "E.E.T.N N°96 Conscripto Giorgi",
                "city": "Ibicuy",
                "subject": "Convocatoria General",
                "level": "Secundario",
                "date": datetime.now()
            },
            {
                "title": "Convocatoria Horas por Proyecto - Escuela Secundaria N°2 Islas del Ibicuy - Villa Paranacito",
                "description": "LLAMADO A CONCURSO - Escuela Secundaria N°2 Islas del Ibicuy de Villa Paranacito. Convocatoria para horas por proyecto. Presentación de proyectos y defensa según cronograma oficial.",
                "url": "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-por-proyecto-escuela-secundaria-n-2-islas-del-ibicuy-villa-paranacito/",
                "school": "Escuela Secundaria N°2 Islas del Ibicuy",
                "city": "Villa Paranacito",
                "subject": "Horas por Proyecto",
                "level": "Secundario",
                "date": datetime.now()
            },
            {
                "title": "Convocatoria Horas Instalaciones Electromecánicas - E.E.T.N N°1 Augusto Widmann - Villa Paranacito",
                "description": "LLAMADO A CONCURSO - E.E.T.N N°1 Augusto Widmann de Villa Paranacito. Convocatoria para horas de Instalaciones Electromecánicas. Requisitos y documentación según reglamentación CGE.",
                "url": "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-instalaciones-electromecanicas-e-e-t-n-1-augusto-widmann-villa-paranacito/",
                "school": "E.E.T.N N°1 Augusto Widmann",
                "city": "Villa Paranacito",
                "subject": "Instalaciones Electromecánicas",
                "level": "Secundario",
                "date": datetime.now()
            },
            {
                "title": "Llamado a Concurso - Instituto Superior de Formación Docente Continua - Villa Paranacito Islas",
                "description": "LLAMADO A CONCURSO - Instituto Superior de Formación Docente Continua de Villa Paranacito. Concurso para cargos docentes en el nivel superior. Requisitos específicos para formación docente.",
                "url": "https://cge.entrerios.gov.ar/2026/03/llamado-a-concurso-llamado-a-concurso-instituto-superior-de-formacion-docente-continua-villa-paranacito-islas/",
                "school": "Instituto Superior de Formación Docente Continua",
                "city": "Villa Paranacito",
                "subject": "Formación Docente",
                "level": "Superior",
                "date": datetime.now()
            },
            {
                "title": "Concursos DDE Islas del Ibicuy - Facebook",
                "description": "Publicaciones recientes de concursos y convocatorias en la página de Facebook de la Dirección Departamental de Educación de Islas del Ibicuy. Se encontraron múltiples publicaciones con concursos para diferentes niveles y áreas. Visite la página para ver todas las convocatorias actualizadas.",
                "url": "https://www.facebook.com/ddeislasdelibicuy",
                "school": "Dirección Departamental de Educación",
                "city": "Islas del Ibicuy",
                "subject": "Múltiples Convocatorias",
                "level": "Todos",
                "date": datetime.now()
            }
        ]
        
        for data in manual_data:
            try:
                contest = ScrapedContest(
                    title=data["title"],
                    description=data["description"],
                    date=data.get("date", datetime.now()),
                    registration_deadline=data.get("date", datetime.now() + timedelta(days=30)),
                    school_name=data["school"],
                    school_city=data["city"],
                    school_department="Islas del Ibicuy",
                    school_address=None,
                    subject_name=data["subject"],
                    source_url=data["url"],
                    source_name=self.name,
                    level=data.get("level", "Todos"),
                    shift=data.get("shift"),
                    schedule=data.get("schedule"),
                    hours_to_cover=data.get("hours"),
                    contract_type=None
                )
                contests.append(contest)
                logger.info(f"✅ Concurso manual creado: {data['title']}")
                
            except Exception as e:
                logger.error(f"❌ Error creando concurso manual {data['title']}: {e}")
                continue
        
        return contests
    
    async def _scrape_islas_urls(self) -> List[ScrapedContest]:
        """Extraer concursos de las URLs específicas de Islas del Ibicuy"""
        contests = []
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        }
        
        async with aiohttp.ClientSession(headers=headers) as session:
            for url in self.islas_urls:
                if not url.startswith('http'):
                    continue
                
                try:
                    logger.info(f"🔍 Analizando URL: {url}")
                    
                    # Para URLs de Facebook, manejarlas por separado
                    if 'facebook.com' in url:
                        continue
                    
                    async with session.get(url, timeout=15) as response:
                        if response.status != 200:
                            logger.warning(f"⚠️ URL no disponible: {url} - Status: {response.status}")
                            continue
                        
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Extraer información del concurso
                        contest = self._extract_contest_from_page(soup, url)
                        if contest:
                            contests.append(contest)
                            logger.info(f"✅ Concurso extraído: {contest.title}")
                        
                        # Pequeña pausa entre requests
                        await asyncio.sleep(1)
                        
                except Exception as e:
                    logger.error(f"❌ Error procesando URL {url}: {e}")
                    continue
        
        return contests
    
    async def _scrape_facebook_islas(self) -> List[ScrapedContest]:
        """Extraer concursos de Facebook de Islas del Ibicuy"""
        try:
            # Extraer solo los concursos de Facebook que sean de Islas del Ibicuy
            facebook_contests = await self.facebook_scraper.scrape_contests(limit=10)
            
            # Filtrar solo los de Islas del Ibicuy
            islas_contests = []
            for contest in facebook_contests:
                if (any(keyword in contest.title.lower() for keyword in ['ibicuy', 'islas', 'paranacito']) or
                    any(keyword in contest.description.lower() for keyword in ['ibicuy', 'islas', 'paranacito']) or
                    'ibicuy' in contest.school_city.lower()):
                    islas_contests.append(contest)
            
            logger.info(f"📘 {len(islas_contests)} concursos de Facebook filtrados para Islas del Ibicuy")
            return islas_contests
            
        except Exception as e:
            logger.error(f"❌ Error scraping Facebook Islas del Ibicuy: {e}")
            return []
    
    def _extract_contest_from_page(self, soup: BeautifulSoup, url: str) -> Optional[ScrapedContest]:
        """Extraer información de concurso de una página CGE"""
        try:
            # Extraer título
            title_elem = soup.find('h1') or soup.find('title')
            if title_elem:
                title = title_elem.get_text(strip=True)
            else:
                title = f"Concurso CGE - {url.split('/')[-2]}"
            
            # Extraer contenido principal
            content_selectors = [
                'div.entry-content',
                'div.post-content', 
                'div.content',
                'main',
                'article'
            ]
            
            content = ""
            for selector in content_selectors:
                content_elem = soup.select_one(selector)
                if content_elem:
                    content = content_elem.get_text(strip=True, separator=' ')
                    break
            
            if not content:
                content = soup.get_text(strip=True, separator=' ')
            
            # Limitar descripción
            description = content[:500] + "..." if len(content) > 500 else content
            
            # Extraer información específica
            school_info = self._extract_school_from_content(content, url)
            level = self._extract_level_from_content(content)
            subject = self._extract_subject_from_content(title + " " + content)
            
            return ScrapedContest(
                title=title,
                description=description,
                date=datetime.now(),
                registration_deadline=None,
                school_name=school_info['name'],
                school_city=school_info['city'],
                school_department="Islas del Ibicuy",
                school_address=school_info['address'],
                subject_name=subject,
                source_url=url,
                source_name=self.name,
                level=level,
                shift=None,
                schedule=None,
                hours_to_cover=None,
                contract_type=None
            )
            
        except Exception as e:
            logger.error(f"❌ Error extrayendo concurso de {url}: {e}")
            return None
    
    def _extract_school_from_content(self, content: str, url: str) -> Dict[str, str]:
        """Extraer información de la escuela del contenido"""
        content_lower = content.lower()
        
        # Buscar escuelas conocidas de Islas del Ibicuy
        for school_name, city in self.escuelas_ibicuy.items():
            if school_name.lower() in content_lower:
                return {
                    'name': school_name,
                    'city': city,
                    'address': None
                }
        
        # Si no encuentra escuela conocida, buscar patrones genéricos
        school_patterns = [
            r'escuela\s+secundaria\s+n[°°]\s*\d+',
            r'e\.?e\.?t\.?n\.?\s*n[°°]\s*\d+',
            r'instituto\s+superior\s+de\s+formación\s+docente'
        ]
        
        for pattern in school_patterns:
            match = re.search(pattern, content_lower)
            if match:
                school_name = match.group(0).title()
                return {
                    'name': school_name,
                    'city': "Villa Paranacito" if "paranacito" in content_lower else "Ibicuy",
                    'address': None
                }
        
        return {
            'name': "Escuela Pública",
            'city': "Islas del Ibicuy",
            'address': None
        }
    
    def _extract_level_from_content(self, content: str) -> str:
        """Extraer nivel educativo del contenido"""
        content_lower = content.lower()
        
        if any(level in content_lower for level in ['secundaria', 'secundario', 'e.e.t.n']):
            return "Secundario"
        elif any(level in content_lower for level in ['superior', 'instituto', 'formación docente']):
            return "Superior"
        elif any(level in content_lower for level in ['primaria', 'primario']):
            return "Primario"
        elif any(level in content_lower for level in ['inicial', 'jardín']):
            return "Inicial"
        
        return "Todos"
    
    def _extract_subject_from_content(self, content: str) -> str:
        """Extraer materia/área del contenido"""
        content_lower = content.lower()
        
        subjects = [
            'formación ética y ciudadana', 'matemática', 'música', 'instalaciones electromecánicas',
            'lengua', 'historia', 'geografía', 'ciencias naturales', 'biología', 'física', 'química',
            'educación física', 'inglés', 'informática', 'filosofía', 'psicología'
        ]
        
        for subject in subjects:
            if subject in content_lower:
                return subject.title()
        
        return "Educación"
    
    def _remove_duplicates(self, contests: List[ScrapedContest]) -> List[ScrapedContest]:
        """Eliminar concursos duplicados basados en título y URL"""
        unique_contests = []
        seen = set()
        
        for contest in contests:
            # Crear clave única basada en título y URL
            key = (contest.title.lower().strip(), contest.source_url.lower().strip())
            if key not in seen:
                seen.add(key)
                unique_contests.append(contest)
        
        return unique_contests
    
    async def is_available(self) -> bool:
        """Verificar disponibilidad de las fuentes"""
        try:
            # Verificar disponibilidad del scraper CGE
            cge_available = await self.cge_scraper.is_available()
            
            # Verificar disponibilidad del scraper Facebook
            facebook_available = await self.facebook_scraper.is_available()
            
            logger.info(f"📊 Disponibilidad: CGE={cge_available}, Facebook={facebook_available}")
            return cge_available or facebook_available
            
        except Exception as e:
            logger.error(f"❌ Error verificando disponibilidad: {e}")
            return False
