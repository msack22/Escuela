from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from ..entities.contest import Contest

class ContestService(ABC):
    """Interface for Contest domain service"""
    
    @abstractmethod
    async def get_recommended_contests(self, user_profile: Dict[str, Any]) -> List[Contest]:
        """Get recommended contests based on user profile"""
        pass
    
    @abstractmethod
    async def validate_contest_requirements(self, contest: Contest, user_qualifications: Dict[str, Any]) -> bool:
        """Validate if user meets contest requirements"""
        pass
    
    @abstractmethod
    async def calculate_contest_score(self, contest: Contest) -> float:
        """Calculate relevance score for a contest"""
        pass
