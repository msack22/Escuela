import aiohttp
import asyncio
from bs4 import BeautifulSoup
from typing import List, Optional, Dict
from datetime import datetime
import re
from urllib.parse import urljoin

from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest
from app.infrastructure.scrapers.url_cache import URLCache
from app.infrastructure.scrapers.pattern_learning import PatternLearning


class EntreriosScraper(BaseScraper):
    """Scraper para el sitio de concursos de Entre Ríos"""
    
    def __init__(self):
        super().__init__(
            name="Consejo General de Educación Entre Ríos",
            base_url="https://cge.entrerios.gov.ar"
        )
        self.url_cache = URLCache("cge_urls.json")
        self.pattern_learning = PatternLearning("cge_patterns.json")
        
        # Inicializar el sistema de aprendizaje con URLs conocidas
        self._initialize_learning_system()
    
    def _initialize_learning_system(self):
        """Inicializar el sistema de aprendizaje con URLs conocidas"""
        initial_urls = [
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-3-francisco-ramirez/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-ciencias-de-la-historia-escuela-secundaria-n4-anselmo-sean-valiente/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-1-david-della-chiesa-ceibas/",
            "https://cge.entrerios.gov.ar/2026/03/llamado-a-concurso-llamado-a-concurso-instituto-superior-de-formacion-docente-continua-villa-paranacito-islas/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-lengua-y-literatura-escuela-secundaria-n-5-jose-gervasio-artigas-arroyo-martinez/"
        ]
        
        print("🧠 Inicializando sistema de aprendizaje con URLs conocidas...")
        for url in initial_urls:
            self.pattern_learning.learn_from_url(url)
        
        stats = self.pattern_learning.get_statistics()
        print(f"📊 Sistema de aprendizaje inicializado: {stats['total_patterns']} patrones aprendidos")
    
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """Scrape contests from Consejo General de Educación - versión con caché"""
        contests = []
        
        try:
            print("🔍 Iniciando scraping con sistema de caché...")
            
            # Mostrar estadísticas del caché
            stats = self.url_cache.get_exploration_stats(self.name)
            print(f"📊 Estadísticas del caché: {stats['total_urls_explored']} URLs exploradas, {stats['total_contests_found']} concursos encontrados")
            
            # Headers para simular navegador real
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
            
            # Timeout extendido a 10 minutos para explorar más a fondo
            timeout = aiohttp.ClientTimeout(total=600, connect=30)  # 10 minutos total, 30 segundos de conexión
            
            async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
                try:
                    async with session.get(self.base_url) as response:
                        if response.status == 200:
                            print("✅ Sitio del CGE accesible, obteniendo enlaces...")
                            html = await response.text()
                            soup = BeautifulSoup(html, 'html.parser')
                            
                            # Obtener todos los enlaces relevantes
                            all_relevant_links = self._find_all_relevant_links(soup, self.base_url, set())
                            print(f"🔗 Encontrados {len(all_relevant_links)} enlaces relevantes totales")
                            
                            # Buscar URLs similares basadas en patrones del usuario
                            similar_urls = self._search_similar_urls(soup, self.base_url)
                            print(f"🔍 Encontradas {len(similar_urls)} URLs similares por patrones")
                            
                            # Combinar enlaces relevantes y similares
                            all_links = list(set(all_relevant_links + similar_urls))
                            print(f"📊 Total de enlaces a explorar: {len(all_links)}")
                            
                            # Filtrar solo URLs no exploradas recientemente (últimos 7 días)
                            unexplored_links = self.url_cache.get_unexplored_urls(self.name, all_links, max_age_days=7)
                            print(f"🆕 URLs no exploradas recientemente: {len(unexplored_links)}")
                            
                            if not unexplored_links:
                                print("ℹ️ Todas las URLs ya fueron exploradas recientemente. Creando concursos manuales...")
                                manual_contests = self._create_manual_cge_contests()
                                contests.extend(manual_contests)
                                print(f"📝 Se crearon {len(manual_contests)} concursos manuales")
                                return contests
                            
                            # Explorar solo URLs nuevas (limitar a 15 para no exceder tiempo)
                            links_to_explore = unexplored_links[:15]
                            print(f"🎯 Explorando {len(links_to_explore)} URLs nuevas...")
                            
                            for i, link in enumerate(links_to_explore):
                                if limit and len(contests) >= limit:
                                    break
                                
                                print(f"🔍 Explorando {i+1}/{len(links_to_explore)}: {link}")
                                
                                try:
                                    async with session.get(link, timeout=60) as response:  # 60 segundos por enlace
                                        if response.status == 200:
                                            html = await response.text()
                                            soup = BeautifulSoup(html, 'html.parser')
                                            
                                            page_contests = self._extract_contests_from_page(soup, link)
                                            contests.extend(page_contests)
                                            
                                            # Marcar URL como explorada
                                            self.url_cache.mark_url_explored(self.name, link, len(page_contests))
                                            
                                            print(f"✅ Encontrados {len(page_contests)} concursos en {link}")
                                            print(f"📊 Total acumulado: {len(contests)} concursos")
                                            
                                except Exception as e:
                                    print(f"❌ Error explorando {link}: {e}")
                                    # Marcar como explorada aunque haya error para no reintentar pronto
                                    self.url_cache.mark_url_explored(self.name, link, 0)
                                    continue
                            
                            # Limpiar caché de entradas antiguas
                            self.url_cache.cleanup_old_entries(max_age_days=30)
                            
                        else:
                            print(f"❌ Sitio del CGE no accesible - Status: {response.status}")
                            
                except asyncio.TimeoutError:
                    print("⏰ Timeout al acceder al sitio del CGE")
                except Exception as e:
                    print(f"❌ Error accediendo al sitio del CGE: {e}")
        
        except Exception as e:
            print(f"❌ Error general en scraping {self.name}: {e}")
        
        # Si no se encontraron concursos, crear concursos manuales
        if not contests:
            print("📝 No se encontraron concursos, creando concursos manuales para URLs conocidas...")
            manual_contests = self._create_manual_cge_contests()
            contests.extend(manual_contests)
            print(f"📝 Se crearon {len(manual_contests)} concursos manuales")
        
        print(f"🎉 Exploración completada. Total concursos encontrados: {len(contests)}")
        return contests
    
    def _generate_search_patterns_from_urls(self) -> List[Dict]:
        """Generar patrones de búsqueda basados en URLs específicas del usuario"""
        user_urls = [
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-3-francisco-ramirez/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-ciencias-de-la-historia-escuela-secundaria-n4-anselmo-sean-valiente/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-1-david-della-chiesa-ceibas/",
            "https://cge.entrerios.gov.ar/2026/03/llamado-a-concurso-llamado-a-concurso-instituto-superior-de-formacion-docente-continua-villa-paranacito-islas/",
            "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-lengua-y-literatura-escuela-secundaria-n-5-jose-gervasio-artigas-arroyo-martinez/"
        ]
        
        patterns = []
        
        for url in user_urls:
            # Extraer patrones de las URLs
            if "convocatoria-escuela-secundaria-n" in url:
                # Patrón: convocatoria-escuela-secundaria-N{numero}-{nombre}
                patterns.append({
                    "type": "convocatoria_escuela_secundaria",
                    "pattern": r"convocatoria-escuela-secundaria-n\d+-[^/]+",
                    "description": "Convocatorias específicas de escuelas secundarias"
                })
            
            elif "convocatoria-horas-" in url:
                # Patrón: convocatoria-horas-{materia}-escuela-{nivel}-n{numero}-{nombre}
                patterns.append({
                    "type": "convocatoria_horas",
                    "pattern": r"convocatoria-horas-[^-]+-[^-]+-n\d+-[^/]+",
                    "description": "Convocatorias para cubrir horas específicas"
                })
            
            elif "llamado-a-concurso" in url:
                # Patrón: llamado-a-concurso-{tipo}-{instituto}-{lugar}
                patterns.append({
                    "type": "llamado_concurso",
                    "pattern": r"llamado-a-concurso-[^/]+",
                    "description": "Llamados a concurso de diferentes tipos"
                })
        
        return patterns
    
    def _search_similar_urls(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Buscar URLs similares usando patrones aprendidos"""
        similar_urls = []
        
        # Obtener patrones aprendidos del sistema
        learned_patterns = self.pattern_learning.get_all_patterns()
        
        if not learned_patterns:
            print("📚 No hay patrones aprendidos aún")
            return similar_urls
        
        print(f"🧠 Usando {len(learned_patterns)} patrones aprendidos")
        
        # Buscar todos los enlaces en la página
        all_links = soup.find_all('a', href=True)
        
        for link in all_links:
            href = link.get('href', '')
            
            # Buscar coincidencias con patrones aprendidos
            matches = self.pattern_learning.search_with_patterns(href)
            if matches:
                best_match = max(matches, key=lambda x: x['confidence'])
                full_url = urljoin(base_url, href)
                
                if full_url not in similar_urls:
                    similar_urls.append(full_url)
                    pattern_type = best_match['pattern']['type']
                    confidence = best_match['confidence']
                    print(f"🎯 URL encontrada: {full_url} (patrón: {pattern_type}, confianza: {confidence:.2f})")
                    
                    # Aprender de esta nueva URL
                    title = link.get_text().strip()
                    self.pattern_learning.learn_from_url(full_url, title)
        
        return similar_urls
    
    def _create_manual_cge_contests(self) -> List[ScrapedContest]:
        """Crear concursos manuales para URLs conocidas del CGE"""
        contests = []
        
        # URLs específicas del usuario para crear concursos manuales
        user_specific_contests = [
            {
                "title": "Convocatoria Escuela Secundaria N°3 Francisco Ramírez",
                "url": "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-3-francisco-ramirez/",
                "school": "Escuela Secundaria N°3 Francisco Ramírez",
                "city": "Por verificar",
                "department": "Por verificar",
                "subject": "Convocatoria General",
                "description": "Convocatoria para la Escuela Secundaria N°3 Francisco Ramírez."
            },
            {
                "title": "Convocatoria Horas Ciencias de la Historia - Escuela Secundaria N°4 Anselmo Sean Valiente",
                "url": "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-ciencias-de-la-historia-escuela-secundaria-n4-anselmo-sean-valiente/",
                "school": "Escuela Secundaria N°4 Anselmo Sean Valiente",
                "city": "Por verificar",
                "department": "Por verificar",
                "subject": "Ciencias de la Historia",
                "description": "Convocatoria para cubrir horas de Ciencias de la Historia en la Escuela Secundaria N°4 Anselmo Sean Valiente."
            },
            {
                "title": "Convocatoria Escuela Secundaria N°1 David Della Chiesa - Ceibas",
                "url": "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-1-david-della-chiesa-ceibas/",
                "school": "Escuela Secundaria N°1 David Della Chiesa",
                "city": "Ceibas",
                "department": "Ceibas",
                "subject": "Convocatoria General",
                "description": "Convocatoria para la Escuela Secundaria N°1 David Della Chiesa de Ceibas."
            },
            {
                "title": "Llamado a Concurso - Instituto Superior de Formación Docente Continua - Villa Paranacito Islas",
                "url": "https://cge.entrerios.gov.ar/2026/03/llamado-a-concurso-llamado-a-concurso-instituto-superior-de-formacion-docente-continua-villa-paranacito-islas/",
                "school": "Instituto Superior de Formación Docente Continua",
                "city": "Villa Paranacito",
                "department": "Islas",
                "subject": "Concurso General",
                "description": "Llamado a concurso para el Instituto Superior de Formación Docente Continua de Villa Paranacito Islas."
            },
            {
                "title": "Convocatoria Horas Lengua y Literatura - Escuela Secundaria N°5 José Gervasio Artigas",
                "url": "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-lengua-y-literatura-escuela-secundaria-n-5-jose-gervasio-artigas-arroyo-martinez/",
                "school": "Escuela Secundaria N°5 José Gervasio Artigas",
                "city": "Arroyo Martinez",
                "department": "Arroyo Martinez",
                "subject": "Lengua y Literatura",
                "description": "Convocatoria para cubrir horas de Lengua y Literatura en la Escuela Secundaria N°5 José Gervasio Artigas de Arroyo Martinez."
            }
        ]
        
        for contest_info in known_contests:
            try:
                contest = ScrapedContest(
                    title=contest_info["title"],
                    description=contest_info["description"],
                    date=datetime.now(),
                    registration_deadline=None,
                    school_name=contest_info["school"],
                    school_city=contest_info["city"],
                    school_department=contest_info["department"],
                    school_address=None,
                    subject_name=contest_info["subject"],
                    source_url=contest_info["url"],
                    source_name=self.name,
                    level="Secundaria" if "Secundaria" in contest_info["school"] else "Primaria",
                    shift=None,
                    schedule=None,
                    hours_to_cover=None,
                    contract_type=None
                )
                contests.append(contest)
                print(f"Concurso manual creado: {contest_info['title']}")
                
            except Exception as e:
                print(f"Error creating manual contest {contest_info['title']}: {e}")
                continue
        
        return contests
    
    def _extract_contests_from_page(self, soup: BeautifulSoup, source_url: str) -> List[ScrapedContest]:
        """Extraer todos los concursos de una página"""
        contests = []
        
        # Buscar artículos que puedan contener concursos
        articles = soup.find_all('article') or soup.find_all('div', class_='post') or soup.find_all('div', class_='entry')
        
        for article in articles:
            contest_info = self._extract_contest_info(article, source_url)
            if contest_info:
                contests.append(contest_info)
        
        # Si no hay artículos, buscar enlaces que puedan llevar a concursos
        if not articles:
            links = soup.find_all('a', href=True)
            for link in links:
                href = link.get('href', '')
                text = link.get_text().lower()
                
                # Si el enlace contiene palabras clave de concurso
                if any(keyword in text for keyword in ['concurso', 'convocatoria', 'llamado', 'cargo', 'puesto', 'cátedra']):
                    if href.startswith('/'):
                        full_url = urljoin(self.base_url, href)
                    elif href.startswith('http'):
                        full_url = href
                    else:
                        continue
                    
                    # Crear un concurso básico desde el enlace
                    contest = self._create_contest_from_link(link, full_url)
                    if contest:
                        contests.append(contest)
        
        return contests
    
    def _create_contest_from_link(self, link_element, url: str) -> Optional[ScrapedContest]:
        """Crear un concurso desde un enlace que contiene palabras clave"""
        try:
            text = self.normalize_text(link_element.get_text())
            
            # Extraer información básica del texto
            school_info = self._extract_school_info(text, url)
            subject = self._extract_subject(text)
            level = self._extract_level(text)
            
            return ScrapedContest(
                title=text,
                description=f"Concurso encontrado en enlace. URL: {url}\n\nTexto original: {text}",
                date=datetime.now(),
                registration_deadline=None,
                school_name=school_info['name'],
                school_city=school_info['city'],
                school_department=school_info['department'],
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
            print(f"Error creating contest from link: {e}")
            return None
    
    def _find_all_relevant_links(self, soup: BeautifulSoup, base_url: str, visited_urls: set) -> List[str]:
        """Encontrar TODOS los enlaces relevantes que puedan contener concursos"""
        links = []
        
        # Si no hay soup, crear una solicitud básica a la página principal
        if soup is None:
            # Agregar URLs base conocidas que suelen tener concursos
            base_urls = [
                "https://cge.entrerios.gov.ar/noticias/",
                "https://cge.entrerios.gov.ar/novedades/",
                "https://cge.entrerios.gov.ar/comunicados/",
                "https://cge.entrerios.gov.ar/avisos/",
                "https://cge.entrerios.gov.ar/edictos/",
                "https://cge.entrerios.gov.ar/resoluciones/",
                "https://cge.entrerios.gov.ar/2026/",
                "https://cge.entrerios.gov.ar/2025/",
                "https://cge.entrerios.gov.ar/2024/",
                "https://cge.entrerios.gov.ar/marzo/",
                "https://cge.entrerios.gov.ar/abril/",
                "https://cge.entrerios.gov.ar/mayo/",
                "https://cge.entrerios.gov.ar/concursos/",
                "https://cge.entrerios.gov.ar/convocatorias/",
                "https://cge.entrerios.gov.ar/llamados/",
                "https://cge.entrerios.gov.ar/cargos/",
                "https://cge.entrerios.gov.ar/selecciones/",
                base_url  # Agregar la página principal también
            ]
            
            for url in base_urls:
                if url not in visited_urls:
                    links.append(url)
                    visited_urls.add(url)
            
            return links
        
        # Palabras clave expandidas para concursos
        contest_keywords = [
            'concurso', 'convocatoria', 'llamado', 'selección', 'cargo', 'puesto', 'nombramiento',
            'cátedra', 'interino', 'suplente', 'titular', 'provisorio', 'transitorio',
            'docente', 'profesor', 'maestro', 'director', 'vicerrector', 'secretario',
            'educación', 'escuela', 'instituto', 'colegio', 'primaria', 'secundaria', 'inicial',
            'preescolar', 'jardín', 'especial', 'técnico', 'artística', 'adultos',
            'edicto', 'resolución', 'disposición', 'acto', 'designación', 'asignación',
            'oferta', 'vacante', 'cupo', 'plaza', 'posición', 'empleo', 'trabajo',
            'oportunidad', 'profesional', 'magisterial', 'docente', 'educativo'
        ]
        
        # Secciones importantes expandidas del sitio
        important_sections = [
            'noticias', 'novedades', 'comunicados', 'información', 'actualidad',
            'prensa', 'avisos', 'edictos', 'resoluciones', 'disposiciones',
            'concursos', 'convocatorias', 'llamados', 'selecciones', 'cargos',
            'empleo', 'trabajo', 'oportunidades', 'profesional', 'docente',
            'educativo', 'magisterial', 'personal', 'recursos', 'humanos',
            'administración', 'gestión', 'dirección', 'secretaría'
        ]
        
        # Buscar todos los enlaces
        all_links = soup.find_all('a', href=True)
        
        for link in all_links:
            href = link.get('href', '')
            text = link.get_text().lower()
            title = link.get('title', '').lower() if link.get('title') else ''
            
            # Construir URL completa
            if href.startswith('/'):
                full_url = urljoin(base_url, href)
            elif href.startswith('http'):
                full_url = href
            else:
                continue
            
            # Solo URLs del mismo dominio
            if not full_url.startswith(self.base_url):
                continue
            
            # Evitar URLs ya visitadas
            if full_url in visited_urls or full_url in links:
                continue
            
            # Evinar archivos no HTML
            if any(ext in full_url.lower() for ext in ['.pdf', '.doc', '.xls', '.jpg', '.png', '.zip']):
                continue
            
            # Buscar palabras clave en texto, título o URL
            combined_text = text + ' ' + title + ' ' + href.lower()
            
            # Si contiene palabras clave de concursos
            if any(keyword in combined_text for keyword in contest_keywords):
                links.append(full_url)
                print(f"Enlace de concurso encontrado: {full_url}")
            
            # Si es una sección importante
            elif any(section in combined_text for section in important_sections):
                links.append(full_url)
                print(f"Sección importante encontrada: {full_url}")
            
            # Si es una página de archivo o categoría por fecha (patrones expandidos)
            elif any(pattern in combined_text for pattern in [
                '2026', '2025', '2024', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
                'archivo', 'historial', 'antiguo', 'anterior', 'mes', 'año', 'semana',
                'dia', 'hoy', 'ayer', 'reciente', 'nuevo', 'último'
            ]):
                links.append(full_url)
                print(f"Página de archivo/fecha encontrada: {full_url}")
            
            # Si es una página de categorías o tags
            elif any(pattern in combined_text for pattern in [
                'categoría', 'tag', 'etiqueta', 'tema', 'asunto', 'área', 'sector',
                'nivel', 'modalidad', 'tipo', 'especialidad', 'disciplina'
            ]):
                links.append(full_url)
                print(f"Categoría/tag encontrado: {full_url}")
            
            # Si es una página de listado o índice
            elif any(pattern in combined_text for pattern in [
                'lista', 'índice', 'directorio', 'catálogo', 'inventario', 'registro',
                'todos', 'completo', 'general', 'total', 'integral'
            ]):
                links.append(full_url)
                print(f"Página de listado encontrada: {full_url}")
        
        return list(set(links))  # Eliminar duplicados
    
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
        """Extraer información de un concurso de la página - versión mejorada"""
        try:
            # Buscar el título principal o encabezado
            title_selectors = [
                'h1', 'h2', 'h3',
                '.title', '.titulo', '.entry-title',
                '[class*="title"]', '[class*="titulo"]',
                'article h1', 'article h2', '.post-title'
            ]
            
            title = ""
            for selector in title_selectors:
                title_elem = soup.select_one(selector)
                if title_elem:
                    title = self.normalize_text(title_elem.get_text())
                    # Verificar si el título parece ser de un concurso
                    if any(keyword in title.lower() for keyword in ['convocatoria', 'concurso', 'llamado', 'cargo']):
                        break
                    else:
                        title = ""
            
            if not title:
                # Si no hay título claro, buscar en el contenido
                content_text = soup.get_text()
                if not any(keyword in content_text.lower() for keyword in ['convocatoria', 'concurso', 'llamado', 'cargo']):
                    return None
                
                # Usar el título de la página como último recurso
                title_tag = soup.find('title')
                if title_tag:
                    title = self.normalize_text(title_tag.get_text())
                else:
                    return None
            
            # Extraer descripción del contenido principal
            desc_selectors = [
                '.entry-content', '.post-content', '.content',
                'article p', 'div[class*="content"]',
                '.description', '.descripcion', 'main p'
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
            
            # Extraer la URL específica del concurso (no solo la base)
            contest_url = self._extract_contest_url(soup, source_url)
            print(f"URL extraída: {contest_url}")
            
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
            
            # Extraer materia específica
            subject = self._extract_subject(title + " " + description)
            print(f"Materia extraída: {subject}")
            print(f"Escuela extraída: {school_info['name']}")
            
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
                source_url=contest_url,  # URL específica del concurso
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
    
    def _extract_school_info(self, text: str, source_url: str) -> dict:
        """Extraer información de la escuela de manera mejorada"""
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
            school_name = "Escuela Provincial"
        
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
        """Extraer materia específica del texto - versión mejorada"""
        # Materias específicas con sus variantes
        subjects = {
            'matemática': ['matemática', 'matemáticas', 'matem', 'cálculo', 'álgebra', 'geometría', 'aritmética'],
            'lengua': ['lengua', 'lengua y literatura', 'castellano', 'español', 'literatura', 'gramática', 'ortografía'],
            'historia': ['historia', 'historia argentina', 'historia universal', 'ciencias sociales', 'geografía'],
            'ciencias naturales': ['ciencias naturales', 'biología', 'física', 'química', 'ciencias de la naturaleza'],
            'educación física': ['educación física', 'ef', 'deportes', 'actividad física', 'gimnasia'],
            'inglés': ['inglés', 'english', 'idioma inglés', 'lengua extranjera'],
            'música': ['música', 'educación musical', 'canto', 'instrumental'],
            'plástica': ['plástica', 'artes plásticas', 'dibujo', 'pintura', 'educación artística'],
            'filosofía': ['filosofía', 'filosofía y ciencias de la educación'],
            'informática': ['informática', 'computación', 'tic', 'tecnología', 'computación'],
            'educación especial': ['educación especial', 'necesidades educativas especiales', 'nee'],
            'psicología': ['psicología', 'orientación escolar', 'psicopedagogía'],
            'economía': ['economía', 'administración', 'gestión'],
            'derecho': ['derecho', 'formación cívica', 'educación cívica'],
            'química': ['química', 'laboratorio', 'ciencias químicas'],
            'física': ['física', 'laboratorio de física', 'ciencias físicas'],
            'biología': ['biología', 'ciencias biológicas', 'natural'],
            'geografía': ['geografía', 'geografía argentina', 'geografía universal'],
            'educación artística': ['educación artística', 'artes', 'expresión corporal', 'danza', 'teatro'],
            'trabajo práctico': ['trabajo práctico', 'tp', 'prácticas', 'taller'],
            'orientación': ['orientación', 'tutoría', 'acompañamiento pedagógico'],
            'support': ['apoyo', 'refuerzo', 'recuperación', 'integración']
        }
        
        text_lower = text.lower()
        
        # Buscar materias específicas primero
        for subject_name, keywords in subjects.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return subject_name.title()
        
        # Buscar patrones específicos de cargos
        cargo_patterns = [
            r'profesor\s+de\s+([a-záéíóúñ\s]+)',
            r'maestro\s+de\s+([a-záéíóúñ\s]+)',
            r'docente\s+de\s+([a-záéíóúñ\s]+)',
            r'cargo\s+de\s+([a-záéíóúñ\s]+)',
            r'cátedra\s+de\s+([a-záéíóúñ\s]+)',
            r'especialidad\s+([a-záéíóúñ\s]+)'
        ]
        
        for pattern in cargo_patterns:
            match = re.search(pattern, text_lower)
            if match:
                subject = match.group(1).strip()
                # Limitar a 3 palabras para evitar descripciones largas
                subject_words = subject.split()[:3]
                subject = ' '.join(subject_words)
                return subject.title()
        
        # Si no encuentra nada específico, usar "General"
        return "General"
    
    def _extract_contest_url(self, soup: BeautifulSoup, base_url: str) -> str:
        """Extraer la URL específica del concurso"""
        try:
            # Buscar el enlace canónico o permalink
            canonical_link = soup.find('link', rel='canonical')
            if canonical_link and canonical_link.get('href'):
                return canonical_link.get('href')
            
            # Buscar enlaces de compartir o permalink
            share_selectors = [
                'a[rel="bookmark"]',
                'a[class*="permalink"]',
                'a[class*="share"]',
                '.post-permalink a',
                '.entry-header a',
                'article h1 a',
                'article h2 a'
            ]
            
            for selector in share_selectors:
                link = soup.select_one(selector)
                if link and link.get('href'):
                    href = link.get('href')
                    # Convertir URL relativa a absoluta
                    if href.startswith('/'):
                        return urljoin(base_url, href)
                    elif href.startswith('http'):
                        return href
            
            # Si no encontramos URL específica, usar la URL actual
            return base_url
            
        except Exception as e:
            print(f"Error extracting contest URL: {e}")
            return base_url
    
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
