from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class UseCase(ABC):
    """Base use case interface"""
    
    @abstractmethod
    async def execute(self, *args, **kwargs) -> Any:
        """Execute the use case"""
        pass

class ContestUseCases(UseCase):
    """Interface for contest-related use cases"""
    
    @abstractmethod
    async def get_all_contests(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Get all contests with optional filters"""
        pass
    
    @abstractmethod
    async def get_contest_by_id(self, contest_id: int) -> Optional[Dict[str, Any]]:
        """Get contest by ID"""
        pass
    
    @abstractmethod
    async def create_contest(self, contest_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new contest"""
        pass
    
    @abstractmethod
    async def update_contest(self, contest_id: int, contest_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing contest"""
        pass
    
    @abstractmethod
    async def delete_contest(self, contest_id: int) -> bool:
        """Delete a contest"""
        pass
    
    @abstractmethod
    async def search_contests(self, query: str, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Search contests"""
        pass
