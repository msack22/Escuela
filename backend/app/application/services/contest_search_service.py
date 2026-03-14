from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.domain.models.models import Contest, School, Subject
from app.domain.repositories.repositories import ContestRepository, SchoolRepository, SubjectRepository


class ContestFilter(BaseModel):
    """Filter criteria for contest search"""
    subject_id: Optional[int] = None
    city: Optional[str] = None
    department: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    school_name: Optional[str] = None
    title_contains: Optional[str] = None
    is_active: Optional[bool] = True
    # Additional filters
    level: Optional[str] = None
    shift: Optional[str] = None
    min_hours: Optional[int] = None
    max_hours: Optional[int] = None
    contract_type: Optional[str] = None


class ContestSearchService:
    """Service for searching and filtering contests"""
    
    def __init__(self, db: Session):
        self.db = db
        self.contest_repo = ContestRepository(db)
        self.school_repo = SchoolRepository(db)
        self.subject_repo = SubjectRepository(db)
    
    def search_contests(self, filters: ContestFilter, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Search contests with filters and return formatted results"""
        contests = self.contest_repo.get_by_filters(
            subject_id=filters.subject_id,
            city=filters.city,
            department=filters.department,
            date_from=filters.date_from,
            date_to=filters.date_to
        )
        
        # Apply additional filters
        if filters.school_name:
            contests = [c for c in contests if filters.school_name.lower() in c.school.name.lower()]
        
        if filters.title_contains:
            contests = [c for c in contests if filters.title_contains.lower() in c.title.lower()]
        
        if filters.is_active is not None:
            contests = [c for c in contests if c.is_active == filters.is_active]
        
        # New filters for level, shift, hours, contract
        if filters.level:
            contests = [c for c in contests if c.level and filters.level.lower() in c.level.lower()]
        
        if filters.shift:
            contests = [c for c in contests if c.shift and filters.shift.lower() in c.shift.lower()]
        
        if filters.min_hours:
            contests = [c for c in contests if c.hours_to_cover and c.hours_to_cover >= filters.min_hours]
        
        if filters.max_hours:
            contests = [c for c in contests if c.hours_to_cover and c.hours_to_cover <= filters.max_hours]
        
        if filters.contract_type:
            contests = [c for c in contests if c.contract_type and filters.contract_type.lower() in c.contract_type.lower()]
        
        # Pagination
        total = len(contests)
        contests = contests[skip:skip + limit]
        
        # Format results
        formatted_contests = []
        for contest in contests:
            formatted_contests.append(self._format_contest(contest))
        
        return {
            "contests": formatted_contests,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    def _format_contest(self, contest: Contest) -> Dict[str, Any]:
        """Format contest data for API response"""
        return {
            "id": contest.id,
            "title": contest.title,
            "description": contest.description,
            "date": contest.date.isoformat() if contest.date else None,
            "registration_deadline": contest.registration_deadline.isoformat() if contest.registration_deadline else None,
            "school": {
                "id": contest.school.id,
                "name": contest.school.name,
                "city": contest.school.city,
                "department": contest.school.department,
                "address": contest.school.address,
                "latitude": contest.school.latitude,
                "longitude": contest.school.longitude,
                "school_type": contest.school.school_type,
                "school_number": contest.school.school_number
            },
            "subject": {
                "id": contest.subject.id,
                "name": contest.subject.name,
                "description": contest.subject.description
            },
            "source": {
                "url": contest.source_url,
                "name": contest.source_name
            },
            "is_active": contest.is_active,
            # Additional contest details
            "level": contest.level,
            "shift": contest.shift,
            "schedule": contest.schedule,
            "hours_to_cover": contest.hours_to_cover,
            "contract_type": contest.contract_type,
            "created_at": contest.created_at.isoformat() if contest.created_at else None,
            "updated_at": contest.updated_at.isoformat() if contest.updated_at else None
        }
    
    def get_contest_by_id(self, contest_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific contest by ID"""
        contest = self.contest_repo.get_by_id(contest_id)
        if contest:
            return self._format_contest(contest)
        return None
    
    def get_all_subjects(self) -> List[Dict[str, Any]]:
        """Get all available subjects"""
        subjects = self.subject_repo.get_all()
        return [
            {
                "id": subject.id,
                "name": subject.name,
                "description": subject.description
            }
            for subject in subjects
        ]
    
    def get_all_cities(self) -> List[str]:
        """Get all unique cities"""
        cities = self.db.query(School.city).distinct().all()
        return [city[0] for city in cities if city[0]]
    
    def get_all_departments(self) -> List[str]:
        """Get all unique departments"""
        departments = self.db.query(School.department).distinct().all()
        return [dept[0] for dept in departments if dept[0]]
    
    def get_contest_statistics(self) -> Dict[str, Any]:
        """Get statistics about contests"""
        total_contests = self.db.query(Contest).count()
        active_contests = self.db.query(Contest).filter(Contest.is_active == True).count()
        total_schools = self.db.query(School).count()
        total_subjects = self.db.query(Subject).count()
        
        # Contests by month
        from sqlalchemy import func, extract
        contests_by_month = self.db.query(
            extract('year', Contest.date).label('year'),
            extract('month', Contest.date).label('month'),
            func.count(Contest.id).label('count')
        ).group_by(
            extract('year', Contest.date),
            extract('month', Contest.date)
        ).order_by(
            extract('year', Contest.date),
            extract('month', Contest.date)
        ).all()
        
        return {
            "total_contests": total_contests,
            "active_contests": active_contests,
            "total_schools": total_schools,
            "total_subjects": total_subjects,
            "contests_by_month": [
                {
                    "year": int(item.year),
                    "month": int(item.month),
                    "count": item.count
                }
                for item in contests_by_month
            ]
        }
