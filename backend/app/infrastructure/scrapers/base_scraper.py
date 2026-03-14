from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime


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
    
    # Additional contest details
    level: Optional[str] = None          # primaria, secundaria, inicial, etc.
    shift: Optional[str] = None            # mañana, tarde, jornada completa
    schedule: Optional[str] = None          # horarios específicos
    hours_to_cover: Optional[int] = None    # cantidad de horas
    contract_type: Optional[str] = None      # tipo de contrato


class BaseScraper(ABC):
    """Abstract base class for all scrapers following Strategy Pattern"""
    
    def __init__(self, name: str, base_url: str):
        self.name = name
        self.base_url = base_url
    
    @abstractmethod
    async def scrape_contests(self) -> List[ScrapedContest]:
        """
        Scrape contests from the source website.
        
        Returns:
            List of ScrapedContest objects
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
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
