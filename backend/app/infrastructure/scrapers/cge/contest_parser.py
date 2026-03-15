"""
Módulo de parseo de concursos para el scraper CGE
Responsable de extraer información de concursos desde HTML
"""

import logging
from typing import List, Optional
from datetime import datetime

from bs4 import BeautifulSoup
from ..base_scraper import ScrapedContest

logger = logging.getLogger(__name__)


class ContestParser:
    """Parser de concursos para el scraper CGE"""
    
    def __init__(self):
        # Palabras clave que indican concursos
        self.contest_keywords = [
            "concurso", "convocatoria", "llamado", "edicto", "nombramiento", "designación",
            "cátedra", "cargo", "horas", "materia", "asignatura", "suplencia", "interinidad",
            "selección", "postulación", "inscripción", "preinscripción", "presentación"
        ]
    
    def parse_contests_from_page(self, soup: BeautifulSoup, source_url: str) -> List[ScrapedContest]:
        """
        Extraer todos los concursos de una página
        Implementa múltiples estrategias de extracción
        """
        contests = []
        
        # Estrategia 1: Buscar artículos que puedan contener concursos
        article_contests = self._extract_from_articles(soup, source_url)
        contests.extend(article_contests)
        
        # Estrategia 2: Buscar enlaces directos a concursos
        link_contests = self._extract_from_links(soup, source_url)
        contests.extend(link_contests)
        
        # Estrategia 3: Buscar elementos con clases específicas
        class_contests = self._extract_from_classes(soup, source_url)
        contests.extend(class_contests)
        
        # Estrategia 4: Buscar patrones de texto
        text_contests = self._extract_from_text_patterns(soup, source_url)
        contests.extend(text_contests)
        
        logger.info(f"📊 Concursos extraídos de {source_url}: {len(contests)}")
        return contests
    
    def _extract_from_articles(self, soup: BeautifulSoup, source_url: str) -> List[ScrapedContest]:
        """Extraer concursos de artículos"""
        contests = []
        
        # Buscar diferentes tipos de contenedores de artículos
        article_selectors = [
            'article',
            'div.post',
            'div.entry',
            'div.concurso',
            'div.convocatoria',
            'div.llamado'
        ]
        
        for selector in article_selectors:
            articles = soup.select(selector)
            
            for article in articles:
                contest = self._parse_contest_from_element(article, source_url)
                if contest:
                    contests.append(contest)
        
        return contests
    
    def _extract_from_links(self, soup: BeautifulSoup, source_url: str) -> List[ScrapedContest]:
        """Extraer concursos de enlaces directos"""
        contests = []
        
        links = soup.find_all('a', href=True)
        
        for link in links:
            href = link.get('href', '')
            link_text = link.get_text().strip()
            
            # Si el enlace parece ser un concurso, crear un concurso desde el enlace
            if self._is_contest_link(href, link_text) and len(link_text) > 10:
                contest = self._create_contest_from_link(link, source_url)
                if contest:
                    contests.append(contest)
        
        return contests
    
    def _extract_from_classes(self, soup: BeautifulSoup, source_url: str) -> List[ScrapedContest]:
        """Extraer concursos basados en clases CSS específicas"""
        contests = []
        
        # Clases que podrían contener información de concursos
        contest_classes = [
            'contest-title',
            'convocatoria-title',
            'llamado-title',
            'concurso-item',
            'convocatoria-item',
            'post-title',
            'entry-title'
        ]
        
        for class_name in contest_classes:
            elements = soup.find_all(class_=class_name)
            
            for element in elements:
                contest = self._parse_contest_from_element(element, source_url)
                if contest:
                    contests.append(contest)
        
        return contests
    
    def _extract_from_text_patterns(self, soup: BeautifulSoup, source_url: str) -> List[ScrapedContest]:
        """Extraer concursos basados en patrones de texto"""
        contests = []
        
        # Buscar patrones de texto en la página
        text_elements = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'])
        
        for element in text_elements:
            text = element.get_text().strip()
            
            # Si el texto contiene palabras clave de concurso y es lo suficientemente largo
            if (self._contains_contest_keywords(text) and 
                len(text) > 10 and 
                len(text) < 200):
                
                contest = self._create_contest_from_text(text, source_url)
                if contest:
                    contests.append(contest)
        
        return contests
    
    def _parse_contest_from_element(self, element, source_url: str) -> Optional[ScrapedContest]:
        """Parsear un concurso desde un elemento HTML"""
        try:
            # Extraer título del elemento
            title_elem = (element.find('h1') or element.find('h2') or 
                         element.find('h3') or element.find('title') or element)
            
            if not title_elem:
                # Si no hay título, usar el texto del elemento
                title_text = element.get_text().strip()
            else:
                title_text = title_elem.get_text().strip()
            
            if not title_text or len(title_text) < 10:
                return None
            
            # Verificar si contiene palabras clave de concursos
            if not self._contains_contest_keywords(title_text):
                return None
            
            return self._create_contest_from_text(title_text, source_url)
            
        except Exception as e:
            logger.error(f"❌ Error parseando concurso desde elemento: {e}")
            return None
    
    def _create_contest_from_link(self, link_element, source_url: str) -> Optional[ScrapedContest]:
        """Crear un concurso desde un elemento de enlace"""
        try:
            link_text = link_element.get_text().strip()
            href = link_element.get('href', '')
            
            if not link_text or len(link_text) < 10:
                return None
            
            # Construir URL completa
            from urllib.parse import urljoin
            full_url = urljoin(source_url, href)
            
            return ScrapedContest(
                title=link_text[:200],
                description=f"Concurso encontrado desde enlace: {link_text[:500]}...\n\nURL: {full_url}",
                date=datetime.now(),
                registration_deadline=None,
                school_name=self._extract_school_from_url(full_url),
                school_city=self._extract_city_from_url(full_url),
                school_department=self._extract_department_from_url(full_url),
                school_address=None,
                subject_name="Concurso desde Enlace",
                source_url=full_url,
                source_name="Consejo General de Educación Entre Ríos",
                publication_link=full_url,
                level="Todos"
            )
            
        except Exception as e:
            logger.error(f"❌ Error creando concurso desde enlace: {e}")
            return None
    
    def _create_contest_from_text(self, text: str, source_url: str) -> Optional[ScrapedContest]:
        """Crear un concurso desde texto"""
        try:
            return ScrapedContest(
                title=text[:200],
                description=f"Concurso encontrado automáticamente en la página.\n\nTexto: {text[:500]}...\n\nURL: {source_url}",
                date=datetime.now(),
                registration_deadline=None,
                school_name=self._extract_school_from_url(source_url),
                school_city=self._extract_city_from_url(source_url),
                school_department=self._extract_department_from_url(source_url),
                school_address=None,
                subject_name="Concurso Detectado",
                source_url=source_url,
                source_name="Consejo General de Educación Entre Ríos",
                publication_link=source_url,
                level="Todos"
            )
            
        except Exception as e:
            logger.error(f"❌ Error creando concurso desde texto: {e}")
            return None
    
    def _contains_contest_keywords(self, text: str) -> bool:
        """Verificar si el texto contiene palabras clave de concursos"""
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in self.contest_keywords)
    
    def _is_contest_link(self, href: str, text: str) -> bool:
        """Verificar si un enlace apunta a un concurso"""
        contest_indicators = [
            "concurso", "convocatoria", "llamado", "edicto", "nombramiento", "designación",
            "catedra", "cargo", "horas", "materia", "asignatura", "suplencia"
        ]
        
        href_lower = href.lower()
        text_lower = text.lower()
        
        return any(indicator in href_lower or indicator in text_lower 
                  for indicator in contest_indicators)
    
    def _extract_school_from_url(self, url: str) -> str:
        """Extraer nombre de escuela desde URL"""
        try:
            if "escuela" in url.lower():
                parts = url.split('/')
                for part in parts:
                    if "escuela" in part.lower():
                        return part.replace('-', ' ').title()
            return "Consejo General de Educación"
        except:
            return "Consejo General de Educación"
    
    def _extract_city_from_url(self, url: str) -> str:
        """Extraer ciudad desde URL"""
        cities = ["paraná", "concepción del uruguay", "gualeguaychú", "concordia", "colón", "villaguay"]
        url_lower = url.lower()
        for city in cities:
            if city.lower() in url_lower:
                return city.title()
        return "Entre Ríos"
    
    def _extract_department_from_url(self, url: str) -> str:
        """Extraer departamento desde URL"""
        return "Entre Ríos"
    
    def get_page_title(self, soup: BeautifulSoup) -> str:
        """Extraer título de la página"""
        try:
            title_tag = soup.find('title')
            if title_tag:
                return title_tag.get_text().strip()
            
            # Si no hay title, buscar h1
            h1_tag = soup.find('h1')
            if h1_tag:
                return h1_tag.get_text().strip()
            
            return "Sin título"
        except:
            return "Sin título"
