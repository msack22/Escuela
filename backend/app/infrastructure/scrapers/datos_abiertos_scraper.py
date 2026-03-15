"""
Scraper para API de Datos Abiertos de Argentina - Capacitaciones y Concursos Docentes
"""

import aiohttp
import asyncio
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
import re
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/datos_abiertos_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest


class DatosAbiertosArgentinaScraper(BaseScraper):
    """Scraper para la API de Datos Abiertos de Argentina"""
    
    def __init__(self):
        super().__init__("Datos Abiertos Argentina", "https://www.datos.gob.ar")
        self.session = None
        self.api_base = "https://www.datos.gob.ar/api/3/action"
        
        # Búsquedas relevantes para educación
        self.search_terms = [
            "educacion",
            "capacitacion", 
            "concurso",
            "docente",
            "formacion",
            "diplomatura",
            "capacitaciones docentes",
            "concursos docentes"
        ]
    
    async def is_available(self) -> bool:
        """Verificar si la API está disponible"""
        try:
            async with aiohttp.ClientSession() as session:
                # Probar con un dataset conocido
                async with session.get(f"{self.api_base}/package_show?id=educacion-base-datos-por-escuela-2017", timeout=10) as response:
                    return response.status == 200
        except Exception as e:
            logger.error(f"Error verificando disponibilidad API: {e}")
            return False
    
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """Extraer información de datasets educativos de la API de datos abiertos"""
        logger.info("Iniciando scraping de API Datos Abiertos Argentina")
        
        all_contests = []
        
        try:
            # Crear sesión persistente
            timeout = aiohttp.ClientTimeout(total=30)
            connector = aiohttp.TCPConnector(limit=10, limit_per_host=5)
            self.session = aiohttp.ClientSession(timeout=timeout, connector=connector)
            
            # Buscar datasets relevantes
            for term in self.search_terms:
                try:
                    datasets = await self._search_datasets(term)
                    for dataset in datasets:
                        contest = await self._process_dataset(dataset)
                        if contest:
                            all_contests.append(contest)
                    
                    # Pequeña pausa entre búsquedas
                    await asyncio.sleep(0.5)
                    
                except Exception as e:
                    logger.error(f"Error buscando datasets para '{term}': {e}")
                    continue
            
            logger.info(f"Scraping API completado. Total datasets encontrados: {len(all_contests)}")
            return all_contests[:limit] if limit else all_contests
            
        except Exception as e:
            logger.error(f"Error general en scraping API: {e}")
            return []
        finally:
            if self.session:
                await self.session.close()
    
    async def _search_datasets(self, search_term: str) -> List[Dict]:
        """Buscar datasets por término"""
        try:
            url = f"{self.api_base}/package_search"
            params = {"q": search_term, "rows": 50}
            
            async with self.session.get(url, params=params) as response:
                if response.status != 200:
                    logger.warning(f"Error HTTP {response.status} buscando '{search_term}'")
                    return []
                
                data = await response.json()
                # La API de CKAN devuelve los resultados en data["result"]["results"]
                result = data.get("result", {})
                return result.get("results", [])
                
        except Exception as e:
            logger.error(f"Error en búsqueda de datasets: {e}")
            return []
    
    async def _process_dataset(self, dataset: Dict) -> Optional[ScrapedContest]:
        """Procesar un dataset individual para crear un ScrapedContest"""
        try:
            title = dataset.get("title", "")
            description = dataset.get("notes", "")
            
            # Filtrar solo datasets relevantes
            if not self._is_relevant_dataset(title, description):
                return None
            
            # Extraer información de recursos
            resources = dataset.get("resources", [])
            if not resources:
                return None
            
            # Crear contest con información del dataset
            contest = ScrapedContest(
                title=title,
                description=description[:500] + "..." if len(description) > 500 else description,
                date=datetime.now(),
                registration_deadline=self._extract_deadline(description),
                school_name="Ministerio de Educación",
                school_city="Argentina",
                school_department="Nacional",
                school_address=None,
                subject_name=self._extract_subject(title),
                source_url=dataset.get("url", ""),
                source_name="Datos Abiertos Argentina",
                level=self._extract_level(title),
                shift=None,
                schedule=None,
                hours_to_cover=None,
                contract_type="Dataset"
            )
            
            return contest
            
        except Exception as e:
            logger.error(f"Error procesando dataset: {e}")
            return None
    
    def _is_relevant_dataset(self, title: str, description: str) -> bool:
        """Determinar si un dataset es relevante para concursos o capacitaciones"""
        title_lower = title.lower()
        description_lower = description.lower()
        
        # Palabras clave relevantes
        relevant_keywords = [
            "concurso", "capacitacion", "formacion", "docente", 
            "diplomatura", "curso", "educacion", "escuela",
            "matricula", "cargos", "relevamiento", "aprender"
        ]
        
        # Palabras a excluir
        exclude_keywords = [
            "infraestructura", "presupuesto", "gasto", "compra", 
            "contratacion", "proveedor", "bien", "servicio"
        ]
        
        # Debe tener palabras clave relevantes
        has_relevant = any(keyword in title_lower or keyword in description_lower 
                          for keyword in relevant_keywords)
        
        # No debe tener palabras clave excluidas
        has_exclude = any(keyword in title_lower or keyword in description_lower 
                         for keyword in exclude_keywords)
        
        return has_relevant and not has_exclude
    
    def _extract_deadline(self, text: str) -> Optional[datetime]:
        """Extraer fecha límite del texto"""
        # Buscar patrones de fecha
        date_patterns = [
            r'cierre[:\s]*(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})',
            r'vencimiento[:\s]*(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})',
            r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})',
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, text.lower())
            if match:
                try:
                    date_str = match.group(1)
                    # Intentar diferentes formatos
                    for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d']:
                        try:
                            return datetime.strptime(date_str, fmt)
                        except ValueError:
                            continue
                except:
                    continue
        
        return None
    
    def _extract_subject(self, title: str) -> str:
        """Extraer materia/área del título"""
        title_lower = title.lower()
        
        subjects = {
            "matemática": "Matemática",
            "lengua": "Lengua y Literatura",
            "ciencias": "Ciencias Naturales",
            "historia": "Historia",
            "geografía": "Geografía",
            "educación física": "Educación Física",
            "inglés": "Inglés",
            "informática": "Informática",
            "arte": "Arte",
            "música": "Música"
        }
        
        for keyword, subject in subjects.items():
            if keyword in title_lower:
                return subject
        
        return "Educación General"
    
    def _extract_level(self, title: str) -> str:
        """Extraer nivel educativo del título"""
        title_lower = title.lower()
        
        levels = {
            "inicial": "Inicial",
            "primario": "Primario", 
            "secundario": "Secundario",
            "superior": "Superior",
            "universitario": "Superior"
        }
        
        for keyword, level in levels.items():
            if keyword in title_lower:
                return level
        
        return "Todos los niveles"


class PuntosDigitalesScraper(BaseScraper):
    """Scraper para API de Puntos Digitales (capacitaciones)"""
    
    def __init__(self):
        super().__init__("Puntos Digitales Argentina", "https://servicios.puntodigital.gob.ar")
        self.session = None
        self.api_url = "https://servicios.puntodigital.gob.ar/ws/ws-eventos.php?method=getCsv"
    
    async def is_available(self) -> bool:
        """Verificar si la API está disponible"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.api_url, timeout=10) as response:
                    return response.status == 200
        except Exception as e:
            logger.error(f"Error verificando disponibilidad API Puntos Digitales: {e}")
            return False
    
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """Extraer capacitaciones de Puntos Digitales"""
        logger.info("Iniciando scraping de API Puntos Digitales")
        
        try:
            timeout = aiohttp.ClientTimeout(total=30)
            connector = aiohttp.TCPConnector(limit=10, limit_per_host=5)
            self.session = aiohttp.ClientSession(timeout=timeout, connector=connector)
            
            # Obtener CSV de capacitaciones
            async with self.session.get(self.api_url) as response:
                if response.status != 200:
                    logger.warning(f"Error HTTP {response.status} en API Puntos Digitales")
                    return []
                
                csv_text = await response.text()
                contests = self._parse_csv_to_contests(csv_text)
                
                logger.info(f"Scraping Puntos Digitales completado. Total capacitaciones: {len(contests)}")
                return contests[:limit] if limit else contests
                
        except Exception as e:
            logger.error(f"Error en scraping Puntos Digitales: {e}")
            return []
        finally:
            if self.session:
                await self.session.close()
    
    def _parse_csv_to_contests(self, csv_text: str) -> List[ScrapedContest]:
        """Parsear CSV de capacitaciones a ScrapedContest"""
        contests = []
        lines = csv_text.strip().split('\n')
        
        if len(lines) < 2:  # CSV vacío o solo encabezados
            return contests
        
        # Procesar líneas (saltar encabezado)
        for line in lines[1:]:
            try:
                fields = line.split(',')
                if len(fields) >= 3:  # Mínimo de campos esperados
                    contest = ScrapedContest(
                        title=fields[0].strip('"'),
                        description=fields[1].strip('"') if len(fields) > 1 else "",
                        date=datetime.now(),
                        registration_deadline=None,
                        school_name="Punto Digital",
                        school_city=fields[2].strip('"') if len(fields) > 2 else "",
                        school_department="Argentina",
                        school_address=None,
                        subject_name="Capacitación Digital",
                        source_url=self.api_url,
                        source_name="Puntos Digitales",
                        level="Todos los niveles",
                        shift=None,
                        schedule=None,
                        hours_to_cover=None,
                        contract_type="Capacitación"
                    )
                    
                    if contest.title and len(contest.title) > 3:
                        contests.append(contest)
                        
            except Exception as e:
                logger.error(f"Error parseando línea CSV: {e}")
                continue
        
        return contests
