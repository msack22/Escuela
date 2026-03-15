from abc import ABC, abstractmethod
from typing import List, Optional, Any, Dict
from datetime import datetime

class BaseRepository(ABC):
    """Base repository interface following Clean Architecture principles"""
    
    @abstractmethod
    async def create(self, entity: Dict[str, Any]) -> Any:
        """Create a new entity"""
        pass
    
    @abstractmethod
    async def get_by_id(self, entity_id: int) -> Optional[Any]:
        """Get entity by ID"""
        pass
    
    @abstractmethod
    async def get_all(self, filters: Optional[Dict[str, Any]] = None) -> List[Any]:
        """Get all entities with optional filters"""
        pass
    
    @abstractmethod
    async def update(self, entity_id: int, data: Dict[str, Any]) -> Optional[Any]:
        """Update entity"""
        pass
    
    @abstractmethod
    async def delete(self, entity_id: int) -> bool:
        """Delete entity"""
        pass
    
    @abstractmethod
    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count entities with optional filters"""
        pass
