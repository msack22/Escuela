from typing import List, Dict, Any, Optional
from datetime import datetime
from application.interfaces.use_cases import ContestUseCases
from domain.repositories.contest_repository import ContestRepository
from domain.entities.contest import Contest

class ContestUseCasesImpl(ContestUseCases):
    """Implementation of contest use cases"""
    
    def __init__(self, contest_repository: ContestRepository):
        self.contest_repository = contest_repository
    
    async def get_all_contests(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Get all contests with optional filters"""
        contests = await self.contest_repository.get_all(filters)
        return [contest.to_dict() for contest in contests]
    
    async def get_contest_by_id(self, contest_id: int) -> Optional[Dict[str, Any]]:
        """Get contest by ID"""
        contest = await self.contest_repository.get_by_id(contest_id)
        return contest.to_dict() if contest else None
    
    async def create_contest(self, contest_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new contest"""
        contest = Contest.from_dict(contest_data)
        created_contest = await self.contest_repository.create(contest_data)
        return created_contest.to_dict()
    
    async def update_contest(self, contest_id: int, contest_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing contest"""
        updated_contest = await self.contest_repository.update(contest_id, contest_data)
        return updated_contest.to_dict() if updated_contest else None
    
    async def delete_contest(self, contest_id: int) -> bool:
        """Delete a contest"""
        return await self.contest_repository.delete(contest_id)
    
    async def search_contests(self, query: str, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Search contests"""
        search_filters = {**(filters or {}), "search": query}
        contests = await self.contest_repository.search_contests(query, filters)
        return [contest.to_dict() for contest in contests]
