from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from ..entities.contest import Contest
from .base import BaseRepository

class ContestRepository(BaseRepository):
    """Interface for Contest repository following Clean Architecture"""
    
    @abstractmethod
    async def get_active_contests(self, limit: Optional[int] = None) -> List[Contest]:
        """Get all active contests"""
        pass
    
    @abstractmethod
    async def get_contests_by_location(self, location: str) -> List[Contest]:
        """Get contests by location"""
        pass
    
    @abstractmethod
    async def get_contests_by_category(self, category: str) -> List[Contest]:
        """Get contests by category"""
        pass
    
    @abstractmethod
    async def search_contests(self, query: str, filters: Optional[Dict[str, Any]] = None) -> List[Contest]:
        """Search contests with text query and filters"""
        pass
    
    @abstractmethod
    async def get_upcoming_deadlines(self, days: int = 7) -> List[Contest]:
        """Get contests with deadlines in the next N days"""
        pass
