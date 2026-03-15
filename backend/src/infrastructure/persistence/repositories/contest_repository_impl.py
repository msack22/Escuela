from typing import List, Optional, Dict, Any
from datetime import datetime
from domain.repositories.contest_repository import ContestRepository
from domain.entities.contest import Contest

class ContestRepositoryImpl(ContestRepository):
    """Implementation of Contest repository using in-memory storage"""
    
    def __init__(self):
        self._contests: List[Contest] = []
        self._next_id = 1
        self._initialize_mock_data()
    
    def _initialize_mock_data(self):
        """Initialize with mock data for development"""
        mock_contests = [
            Contest(
                id=self._next_id,
                title="Concurso Docente Primaria 2024",
                description="Concurso para cargos docentes en nivel primario",
                deadline=datetime(2024, 12, 31),
                status="active",
                requirements=["Título docente", "Experiencia mínima 2 años"],
                location="Buenos Aires",
                salary="$50,000",
                institution="Ministerio de Educación",
                category="Docencia",
                level="Primario"
            ),
            Contest(
                id=self._next_id + 1,
                title="Concurso Administrativo Educativo",
                description="Concurso para puestos administrativos en establecimientos educativos",
                deadline=datetime(2024, 11, 30),
                status="active",
                requirements=["Secundario completo", "Conocimientos de Office"],
                location="Córdoba",
                salary="$40,000",
                institution="Dirección General de Escuelas",
                category="Administrativo",
                level="Todos"
            )
        ]
        
        for contest in mock_contests:
            contest.created_at = datetime.now()
            contest.updated_at = datetime.now()
            self._contests.append(contest)
            self._next_id += 1
    
    async def create(self, entity: Dict[str, Any]) -> Contest:
        """Create a new contest"""
        entity['id'] = self._next_id
        entity['created_at'] = datetime.now()
        entity['updated_at'] = datetime.now()
        
        contest = Contest.from_dict(entity)
        self._contests.append(contest)
        self._next_id += 1
        
        return contest
    
    async def get_by_id(self, entity_id: int) -> Optional[Contest]:
        """Get contest by ID"""
        return next((c for c in self._contests if c.id == entity_id), None)
    
    async def get_all(self, filters: Optional[Dict[str, Any]] = None) -> List[Contest]:
        """Get all contests with optional filters"""
        contests = self._contests
        
        if filters:
            if 'status' in filters:
                contests = [c for c in contests if c.status == filters['status']]
            if 'location' in filters:
                contests = [c for c in contests if c.location == filters['location']]
            if 'category' in filters:
                contests = [c for c in contests if c.category == filters['category']]
        
        return contests
    
    async def update(self, entity_id: int, data: Dict[str, Any]) -> Optional[Contest]:
        """Update contest"""
        contest = await self.get_by_id(entity_id)
        if contest:
            for key, value in data.items():
                if hasattr(contest, key):
                    setattr(contest, key, value)
            contest.updated_at = datetime.now()
        return contest
    
    async def delete(self, entity_id: int) -> bool:
        """Delete contest"""
        original_length = len(self._contests)
        self._contests = [c for c in self._contests if c.id != entity_id]
        return len(self._contests) < original_length
    
    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count contests with optional filters"""
        contests = await self.get_all(filters)
        return len(contests)
    
    async def get_active_contests(self, limit: Optional[int] = None) -> List[Contest]:
        """Get all active contests"""
        active_contests = [c for c in self._contests if c.is_active()]
        if limit:
            return active_contests[:limit]
        return active_contests
    
    async def get_contests_by_location(self, location: str) -> List[Contest]:
        """Get contests by location"""
        return [c for c in self._contests if c.location == location]
    
    async def get_contests_by_category(self, category: str) -> List[Contest]:
        """Get contests by category"""
        return [c for c in self._contests if c.category == category]
    
    async def search_contests(self, query: str, filters: Optional[Dict[str, Any]] = None) -> List[Contest]:
        """Search contests with text query and filters"""
        query_lower = query.lower()
        results = []
        
        for contest in self._contests:
            if (query_lower in contest.title.lower() or 
                query_lower in contest.description.lower()):
                results.append(contest)
        
        return results
    
    async def get_upcoming_deadlines(self, days: int = 7) -> List[Contest]:
        """Get contests with deadlines in the next N days"""
        from datetime import timedelta
        
        cutoff_date = datetime.now() + timedelta(days=days)
        return [c for c in self._contests 
                if c.deadline and c.deadline <= cutoff_date and c.is_active()]
