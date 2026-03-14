from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.domain.models.models import Contest, School, Subject, Diploma, Alert, ScrapingLog


class BaseRepository(ABC):
    """Base repository following the Repository Pattern"""
    
    def __init__(self, db: Session):
        self.db = db


class ContestRepository(BaseRepository):
    """Repository for Contest operations"""
    
    def create(self, contest: Contest) -> Contest:
        self.db.add(contest)
        self.db.commit()
        self.db.refresh(contest)
        return contest
    
    def get_by_id(self, contest_id: int) -> Optional[Contest]:
        return self.db.query(Contest).join(School).join(Subject).filter(Contest.id == contest_id).first()
    
    def get_all(self, skip: int = 0, limit: int = 100) -> List[Contest]:
        return self.db.query(Contest).join(School).join(Subject).offset(skip).limit(limit).all()
    
    def get_active_contests(self) -> List[Contest]:
        return self.db.query(Contest).join(School).join(Subject).filter(Contest.is_active == True).all()
    
    def get_by_filters(
        self, 
        subject_id: Optional[int] = None,
        city: Optional[str] = None,
        department: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> List[Contest]:
        query = self.db.query(Contest).join(School).join(Subject)
        
        if subject_id:
            query = query.filter(Contest.subject_id == subject_id)
        if city:
            query = query.filter(School.city.ilike(f"%{city}%"))
        if department:
            query = query.filter(School.department.ilike(f"%{department}%"))
        if date_from:
            query = query.filter(Contest.date >= date_from)
        if date_to:
            query = query.filter(Contest.date <= date_to)
            
        return query.all()
    
    def get_by_source_url(self, source_url: str) -> Optional[Contest]:
        return self.db.query(Contest).filter(Contest.source_url == source_url).first()
    
    def update(self, contest: Contest) -> Contest:
        self.db.commit()
        self.db.refresh(contest)
        return contest
    
    def delete(self, contest_id: int) -> bool:
        contest = self.get_by_id(contest_id)
        if contest:
            self.db.delete(contest)
            self.db.commit()
            return True
        return False


class SchoolRepository(BaseRepository):
    """Repository for School operations"""
    
    def create(self, school: School) -> School:
        self.db.add(school)
        self.db.commit()
        self.db.refresh(school)
        return school
    
    def get_by_id(self, school_id: int) -> Optional[School]:
        return self.db.query(School).filter(School.id == school_id).first()
    
    def get_by_name_and_city(self, name: str, city: str) -> Optional[School]:
        return self.db.query(School).filter(
            School.name == name,
            School.city == city
        ).first()
    
    def get_all(self, skip: int = 0, limit: int = 100) -> List[School]:
        return self.db.query(School).offset(skip).limit(limit).all()
    
    def get_by_city(self, city: str) -> List[School]:
        return self.db.query(School).filter(School.city == city).all()
    
    def get_by_department(self, department: str) -> List[School]:
        return self.db.query(School).filter(School.department == department).all()


class SubjectRepository(BaseRepository):
    """Repository for Subject operations"""
    
    def create(self, subject: Subject) -> Subject:
        self.db.add(subject)
        self.db.commit()
        self.db.refresh(subject)
        return subject
    
    def get_by_id(self, subject_id: int) -> Optional[Subject]:
        return self.db.query(Subject).filter(Subject.id == subject_id).first()
    
    def get_by_name(self, name: str) -> Optional[Subject]:
        return self.db.query(Subject).filter(Subject.name == name).first()
    
    def get_all(self) -> List[Subject]:
        return self.db.query(Subject).all()
    
    def get_or_create(self, name: str, description: str = None) -> Subject:
        subject = self.get_by_name(name)
        if not subject:
            subject = Subject(name=name, description=description)
            return self.create(subject)
        return subject


class DiplomaRepository(BaseRepository):
    """Repository for Diploma operations"""
    
    def create(self, diploma: Diploma) -> Diploma:
        self.db.add(diploma)
        self.db.commit()
        self.db.refresh(diploma)
        return diploma
    
    def get_by_id(self, diploma_id: int) -> Optional[Diploma]:
        return self.db.query(Diploma).join(School).join(Subject).filter(Diploma.id == diploma_id).first()
    
    def get_all(self, skip: int = 0, limit: int = 100) -> List[Diploma]:
        return self.db.query(Diploma).join(School).join(Subject).offset(skip).limit(limit).all()
    
    def get_active_diplomas(self) -> List[Diploma]:
        return self.db.query(Diploma).join(School).join(Subject).filter(Diploma.is_active == True).all()
    
    def get_by_filters(
        self, 
        subject_id: Optional[int] = None,
        city: Optional[str] = None,
        department: Optional[str] = None,
        start_date_from: Optional[datetime] = None,
        start_date_to: Optional[datetime] = None,
        modality: Optional[str] = None,
        target_audience: Optional[str] = None,
        has_scholarship: Optional[bool] = None
    ) -> List[Diploma]:
        query = self.db.query(Diploma).join(School).join(Subject)
        
        if subject_id:
            query = query.filter(Diploma.subject_id == subject_id)
        if city:
            query = query.filter(School.city.ilike(f"%{city}%"))
        if department:
            query = query.filter(School.department.ilike(f"%{department}%"))
        if start_date_from:
            query = query.filter(Diploma.start_date >= start_date_from)
        if start_date_to:
            query = query.filter(Diploma.start_date <= start_date_to)
        if modality:
            query = query.filter(Diploma.modality == modality)
        if target_audience:
            query = query.filter(Diploma.target_audience.ilike(f"%{target_audience}%"))
        if has_scholarship is not None:
            query = query.filter(Diploma.has_scholarship == has_scholarship)
            
        return query.all()
    
    def get_by_source_url(self, source_url: str) -> Optional[Diploma]:
        return self.db.query(Diploma).filter(Diploma.source_url == source_url).first()
    
    def update(self, diploma: Diploma) -> Diploma:
        self.db.commit()
        self.db.refresh(diploma)
        return diploma
    
    def delete(self, diploma_id: int) -> bool:
        diploma = self.get_by_id(diploma_id)
        if diploma:
            self.db.delete(diploma)
            self.db.commit()
            return True
        return False


class AlertRepository(BaseRepository):
    """Repository for Alert operations"""
    
    def create(self, alert: Alert) -> Alert:
        self.db.add(alert)
        self.db.commit()
        self.db.refresh(alert)
        return alert
    
    def get_by_id(self, alert_id: int) -> Optional[Alert]:
        return self.db.query(Alert).filter(Alert.id == alert_id).first()
    
    def get_active_alerts(self) -> List[Alert]:
        return self.db.query(Alert).filter(Alert.is_active == True).all()
    
    def get_by_whatsapp_number(self, whatsapp_number: str) -> List[Alert]:
        return self.db.query(Alert).filter(
            Alert.whatsapp_number == whatsapp_number,
            Alert.is_active == True
        ).all()


class ScrapingLogRepository(BaseRepository):
    """Repository for ScrapingLog operations"""
    
    def create(self, log: ScrapingLog) -> ScrapingLog:
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log
    
    def get_recent_logs(self, limit: int = 50) -> List[ScrapingLog]:
        return self.db.query(ScrapingLog).order_by(
            ScrapingLog.started_at.desc()
        ).limit(limit).all()
