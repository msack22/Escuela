"""
Módulo de extracción de enlaces para el scraper CGE
Responsable de encontrar y extraer enlaces de concursos
"""

import logging
from typing import List
from urllib.parse import urljoin

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class LinkExtractor:
    """Extractor de enlaces para el scraper CGE"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        
        # Palabras clave que indican concursos
        self.contest_indicators = [
            "concurso", "convocatoria", "llamado", "edicto", "nombramiento", "designación",
            "catedra", "cargo", "horas", "materia", "asignatura", "suplencia",
            "selección", "postulación", "inscripción", "preinscripción", "presentación"
        ]
        
        # Indicadores de niveles educativos
        self.level_indicators = [
            "secundario", "superior", "supervisor", "primario", "inicial", "especial"
        ]
        
        # Indicadores de tipos de plazas
        self.position_indicators = [
            "matemática", "lengua", "literatura", "historia", "geografía", "ciencias",
            "biología", "física", "química", "educación física", "inglés", "francés",
            "italiano", "portugués", "música", "artes", "informática", "filosofía",
            "psicología", "sociología", "economía", "contabilidad", "administración",
            "derecho", "trabajo práctico", "orientación"
        ]
    
    def extract_contest_links(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """
        Extraer enlaces específicos de concursos de una página
        """
        contest_links = []
        
        # Buscar todos los enlaces
        all_links = soup.find_all('a', href=True)
        
        for link in all_links:
            href = link.get('href', '')
            link_text = link.get_text().strip()
            
            # Verificar si es un enlace de concurso
            if self._is_contest_link(href, link_text):
                full_url = urljoin(base_url, href)
                
                # Filtrar URLs duplicadas y válidas
                if (full_url not in contest_links and 
                    'cge.entrerios.gov.ar' in full_url and
                    self._is_valid_contest_url(full_url)):
                    contest_links.append(full_url)
                    logger.info(f"🔗 Enlace de concurso encontrado: {full_url}")
        
        return contest_links
    
    def extract_level_specific_links(self, soup: BeautifulSoup, base_url: str, level: str) -> List[str]:
        """
        Extraer enlaces específicos de un nivel educativo
        """
        level_links = []
        
        # Buscar todos los enlaces
        all_links = soup.find_all('a', href=True)
        
        for link in all_links:
            href = link.get('href', '')
            link_text = link.get_text().strip()
            
            # Verificar si es un enlace del nivel específico
            if self._is_level_specific_link(href, link_text, level):
                full_url = urljoin(base_url, href)
                
                if (full_url not in level_links and 
                    'cge.entrerios.gov.ar' in full_url):
                    level_links.append(full_url)
                    logger.info(f"🎓 Enlace de nivel {level} encontrado: {full_url}")
        
        return level_links
    
    def extract_departamental_links(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """
        Extraer enlaces de páginas departamentales
        """
        departamental_links = []
        
        # Buscar enlaces a páginas departamentales
        all_links = soup.find_all('a', href=True)
        
        for link in all_links:
            href = link.get('href', '')
            link_text = link.get_text().strip()
            
            if self._is_departamental_link(href, link_text):
                full_url = urljoin(base_url, href)
                
                if (full_url not in departamental_links and 
                    'cge.entrerios.gov.ar' in full_url):
                    departamental_links.append(full_url)
                    logger.info(f"🏫 Enlace departamental encontrado: {full_url}")
        
        return departamental_links
    
    def _is_contest_link(self, href: str, text: str) -> bool:
        """Verificar si un enlace apunta a un concurso"""
        href_lower = href.lower()
        text_lower = text.lower()
        
        # Verificar indicadores de concursos
        has_contest_indicator = any(indicator in href_lower or indicator in text_lower 
                                   for indicator in self.contest_indicators)
        
        # Verificar que no sea un enlace irrelevante
        is_not_irrelevant = not any(irrelevant in href_lower 
                                   for irrelevant in ['mailto:', 'tel:', 'javascript:', '#'])
        
        return has_contest_indicator and is_not_irrelevant
    
    def _is_level_specific_link(self, href: str, text: str, level: str) -> bool:
        """Verificar si un enlace es de un nivel educativo específico"""
        href_lower = href.lower()
        text_lower = text.lower()
        level_lower = level.lower()
        
        # Verificar si contiene el nivel específico
        has_level = (level_lower in href_lower or 
                    level_lower in text_lower or
                    any(level_indicator in href_lower or level_indicator in text_lower 
                        for level_indicator in self.level_indicators 
                        if level_indicator in level_lower))
        
        # Verificar que sea un concurso
        is_contest = self._is_contest_link(href, text)
        
        return has_level and is_contest
    
    def _is_departamental_link(self, href: str, text: str) -> bool:
        """Verificar si un enlace es departamental"""
        href_lower = href.lower()
        text_lower = text.lower()
        
        # Indicadores departamentales
        departamental_indicators = [
            'departamental-', 'dde', 'dirección de educación', 'departamento'
        ]
        
        return any(indicator in href_lower or indicator in text_lower 
                  for indicator in departamental_indicators)
    
    def _is_valid_contest_url(self, url: str) -> bool:
        """Verificar si una URL de concurso es válida"""
        # Evitar URLs de archivos o recursos
        invalid_extensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png', '.zip']
        
        return not any(url.lower().endswith(ext) for ext in invalid_extensions)
    
    def extract_links_by_keywords(self, soup: BeautifulSoup, base_url: str, keywords: List[str]) -> List[str]:
        """
        Extraer enlaces basados en palabras clave específicas
        """
        keyword_links = []
        
        # Buscar todos los enlaces
        all_links = soup.find_all('a', href=True)
        
        for link in all_links:
            href = link.get('href', '')
            link_text = link.get_text().strip()
            
            # Verificar si contiene alguna palabra clave
            if self._contains_keywords(href, link_text, keywords):
                full_url = urljoin(base_url, href)
                
                if (full_url not in keyword_links and 
                    'cge.entrerios.gov.ar' in full_url):
                    keyword_links.append(full_url)
                    logger.info(f"🔍 Enlace con palabra clave encontrado: {full_url}")
        
        return keyword_links
    
    def _contains_keywords(self, href: str, text: str, keywords: List[str]) -> bool:
        """Verificar si el enlace contiene las palabras clave"""
        href_lower = href.lower()
        text_lower = text.lower()
        
        return any(keyword.lower() in href_lower or keyword.lower() in text_lower 
                  for keyword in keywords)
