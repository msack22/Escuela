from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from pydantic import BaseModel


@dataclass
class ScrapedContest:
    """Data transfer object for scraped contest information"""
    title: str
    description: str
    date: datetime
    registration_deadline: Optional[datetime]
    school_name: str
    school_city: str
    school_department: str
    school_address: Optional[str]
    subject_name: str
    source_url: str
    source_name: str
    publication_link: Optional[str] = None  # Link de la publicación original
    
    # Additional contest details
    level: Optional[str] = None          # primaria, secundaria, inicial, etc.
    shift: Optional[str] = None            # mañana, tarde, jornada completa
    schedule: Optional[str] = None          # horarios específicos
    hours_to_cover: Optional[int] = None    # cantidad de horas
    contract_type: Optional[str] = None      # tipo de contrato


@dataclass
class ScrapedDiploma:
    """Data transfer object for scraped diploma/capacitación information"""
    title: str
    description: str
    institution_name: str
    institution_city: str
    institution_department: str
    source_url: str
    source_name: str
    
    # Optional fields
    modality: Optional[str] = None  # virtual, presencial, semipresencial
    duration: Optional[str] = None  # ej: "3 meses", "120 horas"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    registration_deadline: Optional[datetime] = None
    
    # Educational level
    target_audience: Optional[str] = None  # docentes, directivos, etc.
    level: Optional[str] = None  # inicial, primario, secundario, etc.
    
    # Cost information
    price: Optional[int] = None  # precio en pesos argentinos
    currency: str = "ARS"
    has_scholarship: bool = False
    scholarship_info: Optional[str] = None
    
    # Optional institution information
    institution_address: Optional[str] = None
    
    # Contact information
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_website: Optional[str] = None


class BaseScraper(ABC):
    """Abstract base class for all scrapers following Strategy Pattern"""
    
    def __init__(self, name: str, base_url: str):
        self.name = name
        self.base_url = base_url
    
    @abstractmethod
    async def scrape_contests(self, limit: Optional[int] = None) -> List[ScrapedContest]:
        """
        Scrape contests from the source website.
        
        Args:
            limit: Optional limit on number of contests to scrape
        
        Returns:
            List of ScrapedContest objects
        """
        pass
    
    async def scrape_diplomas(self, limit: Optional[int] = None) -> List[ScrapedDiploma]:
        """
        Scrape diplomas/capacitaciones from the source website.
        
        Args:
            limit: Optional limit on number of diplomas to scrape
        
        Returns:
            List of ScrapedDiploma objects
        """
        # Default implementation - return empty list
        return []
    
    @abstractmethod
    async def is_available(self) -> bool:
        """
        Check if the scraper source is available.
        
        Returns:
            True if source is accessible, False otherwise
        """
        pass
    
    def normalize_text(self, text: str) -> str:
        """Normalize text by removing extra whitespace and special characters"""
        if not text:
            return ""
        return " ".join(text.strip().split())
    
    def parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string to datetime object"""
        # This method should be overridden by specific scrapers
        # to handle different date formats
        return None
