from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.domain.models.models import Diploma, School, Subject
from app.domain.repositories.repositories import DiplomaRepository, SchoolRepository, SubjectRepository


class DiplomaFilter(BaseModel):
    """Filter criteria for diploma search"""
    subject_id: Optional[int] = None
    city: Optional[str] = None
    department: Optional[str] = None
    start_date_from: Optional[datetime] = None
    start_date_to: Optional[datetime] = None
    institution_name: Optional[str] = None
    title_contains: Optional[str] = None
    is_active: Optional[bool] = True
    # Additional filters
    modality: Optional[str] = None
    target_audience: Optional[str] = None
    has_scholarship: Optional[bool] = None
    level: Optional[str] = None
    min_price: Optional[int] = None
    max_price: Optional[int] = None


class DiplomaSearchService:
    """Service for searching and filtering diplomas"""
    
    def __init__(self, db: Session):
        self.db = db
        self.diploma_repo = DiplomaRepository(db)
        self.school_repo = SchoolRepository(db)
        self.subject_repo = SubjectRepository(db)
    
    def search_diplomas(self, filters: DiplomaFilter, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Search diplomas with filters and return formatted results"""
        # Always use get_all() to ensure relationships are loaded, then apply filters
        diplomas = self.diploma_repo.get_all()
        
        # Apply filters manually
        if filters.subject_id:
            diplomas = [d for d in diplomas if d.subject_id == filters.subject_id]
        if filters.city:
            diplomas = [d for d in diplomas if d.school and filters.city.lower() in d.school.city.lower()]
        if filters.department:
            diplomas = [d for d in diplomas if d.school and filters.department.lower() in d.school.department.lower()]
        if filters.start_date_from:
            diplomas = [d for d in diplomas if d.start_date and d.start_date >= filters.start_date_from]
        if filters.start_date_to:
            diplomas = [d for d in diplomas if d.start_date and d.start_date <= filters.start_date_to]
        
        # Apply additional filters
        if filters.institution_name:
            diplomas = [d for d in diplomas if filters.institution_name.lower() in d.institution_name.lower()]
        
        if filters.title_contains:
            diplomas = [d for d in diplomas if filters.title_contains.lower() in d.title.lower()]
        
        if filters.is_active is not None:
            diplomas = [d for d in diplomas if d.is_active == filters.is_active]
        
        if filters.modality:
            diplomas = [d for d in diplomas if d.modality and filters.modality.lower() in d.modality.lower()]
        
        if filters.target_audience:
            diplomas = [d for d in diplomas if d.target_audience and filters.target_audience.lower() in d.target_audience.lower()]
        
        if filters.has_scholarship is not None:
            diplomas = [d for d in diplomas if d.has_scholarship == filters.has_scholarship]
        
        if filters.level:
            diplomas = [d for d in diplomas if d.level and filters.level.lower() in d.level.lower()]
        
        if filters.min_price:
            diplomas = [d for d in diplomas if d.price and d.price >= filters.min_price]
        
        if filters.max_price:
            diplomas = [d for d in diplomas if d.price and d.price <= filters.max_price]
        
        # Pagination
        total = len(diplomas)
        diplomas = diplomas[skip:skip + limit]
        
        # Format results
        formatted_diplomas = []
        for diploma in diplomas:
            formatted_diplomas.append(self._format_diploma(diploma))
        
        return {
            "diplomas": formatted_diplomas,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    def _format_diploma(self, diploma: Diploma) -> Dict[str, Any]:
        """Format diploma data for API response"""
        return {
            "id": diploma.id,
            "title": diploma.title,
            "description": diploma.description,
            
            # Diploma specific information
            "modality": diploma.modality,
            "duration": diploma.duration,
            "start_date": diploma.start_date.isoformat() if diploma.start_date else None,
            "end_date": diploma.end_date.isoformat() if diploma.end_date else None,
            "registration_deadline": diploma.registration_deadline.isoformat() if diploma.registration_deadline else None,
            
            # Educational level
            "target_audience": diploma.target_audience,
            "level": diploma.level,
            
            # Cost information
            "price": diploma.price,
            "currency": diploma.currency,
            "has_scholarship": diploma.has_scholarship,
            "scholarship_info": diploma.scholarship_info,
            
            # Institution information
            "institution": {
                "id": diploma.school.id if diploma.school else None,
                "name": diploma.institution_name,
                "city": diploma.institution_city,
                "department": diploma.institution_department,
                "address": diploma.institution_address,
                "latitude": diploma.school.latitude if diploma.school else None,
                "longitude": diploma.school.longitude if diploma.school else None,
                "phone": diploma.school.phone if diploma.school else None,
                "email": diploma.school.email if diploma.school else None
            },
            
            # Contact information
            "contact_email": diploma.contact_email,
            "contact_phone": diploma.contact_phone,
            "contact_website": diploma.contact_website,
            
            # Subject information
            "subject": {
                "id": diploma.subject.id if diploma.subject else None,
                "name": diploma.subject.name if diploma.subject else None,
                "description": diploma.subject.description if diploma.subject else None
            },
            
            # Source information
            "source": {
                "url": diploma.source_url,
                "name": diploma.source_name
            },
            
            "is_active": diploma.is_active,
            "created_at": diploma.created_at.isoformat() if diploma.created_at else None,
            "updated_at": diploma.updated_at.isoformat() if diploma.updated_at else None
        }
    
    def get_diploma_by_id(self, diploma_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific diploma by ID"""
        diploma = self.diploma_repo.get_by_id(diploma_id)
        if diploma:
            return self._format_diploma(diploma)
        return None
    
    def get_all_subjects(self) -> List[Dict[str, Any]]:
        """Get all available subjects for filtering"""
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
    
    def get_diploma_statistics(self) -> Dict[str, Any]:
        """Get diploma statistics"""
        active_diplomas = self.diploma_repo.get_active_diplomas()
        
        # Count by modality
        modality_counts = {}
        for diploma in active_diplomas:
            modality = diploma.modality or "No especificada"
            modality_counts[modality] = modality_counts.get(modality, 0) + 1
        
        # Count by level
        level_counts = {}
        for diploma in active_diplomas:
            level = diploma.level or "No especificado"
            level_counts[level] = level_counts.get(level, 0) + 1
        
        # Count by scholarship availability
        scholarship_count = sum(1 for d in active_diplomas if d.has_scholarship)
        
        return {
            "total_active": len(active_diplomas),
            "by_modality": modality_counts,
            "by_level": level_counts,
            "with_scholarship": scholarship_count,
            "without_scholarship": len(active_diplomas) - scholarship_count
        }
