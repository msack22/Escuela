from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.domain.models.models import Contest, School, Subject
from app.domain.repositories.repositories import ContestRepository, SchoolRepository, SubjectRepository
from app.infrastructure.scrapers.base_scraper import ScrapedContest


class ContestProcessingService:
    """Service for processing scraped contests and storing them in database"""
    
    def __init__(self, db: Session):
        self.db = db
        self.contest_repo = ContestRepository(db)
        self.school_repo = SchoolRepository(db)
        self.subject_repo = SubjectRepository(db)
    
    async def process_scraped_contests(self, scraped_contests: List[ScrapedContest]) -> List[Contest]:
        """Process a list of scraped contests and store them in database"""
        processed_contests = []
        
        for scraped_contest in scraped_contests:
            try:
                # Check if contest already exists
                existing = self.contest_repo.get_by_source_url(scraped_contest.source_url)
                if existing:
                    continue  # Skip duplicates
                
                # Get or create school
                school = await self._get_or_create_school(scraped_contest)
                
                # Get or create subject
                subject = await self._get_or_create_subject(scraped_contest)
                
                # Create contest
                contest = Contest(
                    title=scraped_contest.title,
                    description=scraped_contest.description,
                    date=scraped_contest.date,
                    registration_deadline=scraped_contest.registration_deadline,
                    school_id=school.id,
                    subject_id=subject.id,
                    source_url=scraped_contest.source_url,
                    source_name=scraped_contest.source_name,
                    is_active=True,
                    is_processed=True,
                    # Additional details
                    level=scraped_contest.level,
                    shift=scraped_contest.shift,
                    schedule=scraped_contest.schedule,
                    hours_to_cover=scraped_contest.hours_to_cover,
                    contract_type=scraped_contest.contract_type
                )
                
                created_contest = self.contest_repo.create(contest)
                processed_contests.append(created_contest)
                
            except Exception as e:
                print(f"Error processing contest '{scraped_contest.title}': {e}")
                continue
        
        return processed_contests
    
    async def _get_or_create_school(self, scraped_contest: ScrapedContest) -> School:
        """Get existing school or create new one"""
        # Try to find existing school by name and city
        school = self.school_repo.get_by_name_and_city(
            scraped_contest.school_name,
            scraped_contest.school_city
        )
        
        if not school:
            # Create new school
            school = School(
                name=scraped_contest.school_name,
                city=scraped_contest.school_city,
                department=scraped_contest.school_department,
                address=scraped_contest.school_address,
                latitude=None,  # Will be filled by geocoding service
                longitude=None,
                phone=None,
                email=None
            )
            school = self.school_repo.create(school)
        
        return school
    
    async def _get_or_create_subject(self, scraped_contest: ScrapedContest) -> Subject:
        """Get existing subject or create new one"""
        return self.subject_repo.get_or_create(
            name=scraped_contest.subject_name,
            description=f"Subject: {scraped_contest.subject_name}"
        )
    
    def get_unprocessed_contests(self) -> List[Contest]:
        """Get contests that haven't been processed for notifications"""
        return self.db.query(Contest).filter(
            Contest.is_processed == False,
            Contest.is_active == True
        ).all()
    
    def mark_contest_as_processed(self, contest_id: int):
        """Mark a contest as processed"""
        contest = self.contest_repo.get_by_id(contest_id)
        if contest:
            contest.is_processed = True
            self.contest_repo.update(contest)
