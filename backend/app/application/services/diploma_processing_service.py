from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.domain.models.models import Diploma, School, Subject
from app.domain.repositories.repositories import DiplomaRepository, SchoolRepository, SubjectRepository
from app.infrastructure.scrapers.base_scraper import ScrapedDiploma


class DiplomaProcessingService:
    """Service for processing scraped diplomas and storing them in database"""
    
    def __init__(self, db: Session):
        self.db = db
        self.diploma_repo = DiplomaRepository(db)
        self.school_repo = SchoolRepository(db)
        self.subject_repo = SubjectRepository(db)
    
    async def process_scraped_diplomas(self, scraped_diplomas: List[ScrapedDiploma]) -> List[Diploma]:
        """Process a list of scraped diplomas and store them in database"""
        processed_diplomas = []
        
        for scraped_diploma in scraped_diplomas:
            try:
                # Check if diploma already exists
                existing = self.diploma_repo.get_by_source_url(scraped_diploma.source_url)
                if existing:
                    continue  # Skip duplicates
                
                # Get or create school
                school = await self._get_or_create_school(scraped_diploma)
                
                # Get or create subject
                subject = await self._get_or_create_subject(scraped_diploma)
                
                # Create diploma
                diploma = Diploma(
                    title=scraped_diploma.title,
                    description=scraped_diploma.description,
                    modality=scraped_diploma.modality,
                    duration=scraped_diploma.duration,
                    start_date=scraped_diploma.start_date,
                    end_date=scraped_diploma.end_date,
                    registration_deadline=scraped_diploma.registration_deadline,
                    target_audience=scraped_diploma.target_audience,
                    level=scraped_diploma.level,
                    price=scraped_diploma.price,
                    currency=scraped_diploma.currency,
                    has_scholarship=scraped_diploma.has_scholarship,
                    scholarship_info=scraped_diploma.scholarship_info,
                    institution_name=scraped_diploma.institution_name,
                    institution_city=scraped_diploma.institution_city,
                    institution_department=scraped_diploma.institution_department,
                    institution_address=scraped_diploma.institution_address,
                    contact_email=scraped_diploma.contact_email,
                    contact_phone=scraped_diploma.contact_phone,
                    contact_website=scraped_diploma.contact_website,
                    school_id=school.id,
                    subject_id=subject.id,
                    source_url=scraped_diploma.source_url,
                    source_name=scraped_diploma.source_name,
                    is_active=True,
                    is_processed=True
                )
                
                created_diploma = self.diploma_repo.create(diploma)
                processed_diplomas.append(created_diploma)
                
            except Exception as e:
                print(f"Error processing diploma '{scraped_diploma.title}': {e}")
                continue
        
        return processed_diplomas
    
    async def _get_or_create_school(self, scraped_diploma: ScrapedDiploma) -> School:
        """Get existing school or create new one"""
        # Try to find existing school by name and city
        school = self.school_repo.get_by_name_and_city(
            scraped_diploma.institution_name,
            scraped_diploma.institution_city
        )
        
        if not school:
            # Create new school
            school = School(
                name=scraped_diploma.institution_name,
                city=scraped_diploma.institution_city,
                department=scraped_diploma.institution_department,
                address=scraped_diploma.institution_address,
                latitude=None,  # Will be filled by geocoding service
                longitude=None,
                phone=scraped_diploma.contact_phone,
                email=scraped_diploma.contact_email
            )
            school = self.school_repo.create(school)
        
        return school
    
    async def _get_or_create_subject(self, scraped_diploma: ScrapedDiploma) -> Subject:
        """Get existing subject or create new one"""
        # Try to determine subject from diploma title and description
        subject_name = self._extract_subject_from_diploma(scraped_diploma.title, scraped_diploma.description)
        return self.subject_repo.get_or_create(
            name=subject_name,
            description=f"Subject: {subject_name}"
        )
    
    def _extract_subject_from_diploma(self, title: str, description: str) -> str:
        """Extract subject from diploma title and description"""
        text = (title + " " + description).lower()
        
        # Common diploma subjects
        subjects = {
            'docencia': ['docencia', 'enseñanza', 'pedagogía', 'educación'],
            'matemática': ['matemática', 'matemáticas', 'cálculo', 'álgebra'],
            'lengua': ['lengua', 'castellano', 'español', 'literatura', 'gramática'],
            'ciencias naturales': ['ciencias naturales', 'biología', 'física', 'química'],
            'educación física': ['educación física', 'deportes', 'actividad física'],
            'informática': ['informática', 'computación', 'tic', 'tecnología'],
            'inglés': ['inglés', 'english', 'idioma inglés'],
            'psicología': ['psicología', 'psicopedagogía'],
            'gestión educativa': ['gestión', 'dirección', 'administración', 'liderazgo'],
            'educación especial': ['educación especial', 'necesidades educativas', 'inclusión'],
            'educación inicial': ['inicial', 'jardín', 'preescolar', 'educación inicial'],
            'educación primaria': ['primaria', 'educación primaria'],
            'educación secundaria': ['secundaria', 'educación secundaria']
        }
        
        for subject_name, keywords in subjects.items():
            for keyword in keywords:
                if keyword in text:
                    return subject_name.title()
        
        return "Diplomatura"
    
    def get_unprocessed_diplomas(self) -> List[Diploma]:
        """Get diplomas that haven't been processed for notifications"""
        return self.db.query(Diploma).filter(
            Diploma.is_processed == False,
            Diploma.is_active == True
        ).all()
