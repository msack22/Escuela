from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.application.services.contest_search_service import ContestSearchService, ContestFilter
from app.domain.models.models import Contest

router = APIRouter()


@router.delete("/clear")
async def clear_all_contests(db: Session = Depends(get_db)):
    """Clear all contests (temporary endpoint for testing)"""
    try:
        # Delete all contests
        db.query(Contest).delete()
        db.commit()
        return {"message": "All contests cleared successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=dict)
async def get_contests(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    subject_id: Optional[int] = Query(None),
    city: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    school_name: Optional[str] = Query(None),
    title_contains: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    # New query parameters
    level: Optional[str] = Query(None),
    shift: Optional[str] = Query(None),
    min_hours: Optional[int] = Query(None),
    max_hours: Optional[int] = Query(None),
    contract_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get contests with optional filters"""
    service = ContestSearchService(db)
    
    filters = ContestFilter(
        subject_id=subject_id,
        city=city,
        department=department,
        date_from=date_from,
        date_to=date_to,
        school_name=school_name,
        title_contains=title_contains,
        is_active=is_active,
        # New filters
        level=level,
        shift=shift,
        min_hours=min_hours,
        max_hours=max_hours,
        contract_type=contract_type
    )
    
    result = service.search_contests(filters, skip, limit)
    return result


@router.get("/{contest_id}", response_model=dict)
async def get_contest(contest_id: int, db: Session = Depends(get_db)):
    """Get a specific contest by ID"""
    service = ContestSearchService(db)
    contest = service.get_contest_by_id(contest_id)
    
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    
    return contest


@router.get("/statistics/summary")
async def get_contest_statistics(db: Session = Depends(get_db)):
    """Get contest statistics"""
    service = ContestSearchService(db)
    return service.get_contest_statistics()


@router.get("/filters/subjects")
async def get_all_subjects(db: Session = Depends(get_db)):
    """Get all available subjects for filtering"""
    service = ContestSearchService(db)
    return service.get_all_subjects()


@router.get("/filters/cities")
async def get_all_cities(db: Session = Depends(get_db)):
    """Get all available cities for filtering"""
    service = ContestSearchService(db)
    return {"cities": service.get_all_cities()}


@router.get("/filters/levels")
async def get_all_levels(db: Session = Depends(get_db)):
    """Get all available contest levels for filtering"""
    levels = ["Inicial", "Primaria", "Secundaria", "Jardín"]
    return {"levels": levels}


@router.get("/filters/shifts")
async def get_all_shifts(db: Session = Depends(get_db)):
    """Get all available shifts for filtering"""
    shifts = ["Mañana", "Tarde", "Jornada Completa", "Vespertina", "Nocturna"]
    return {"shifts": shifts}


@router.get("/filters/contract-types")
async def get_all_contract_types(db: Session = Depends(get_db)):
    """Get all available contract types for filtering"""
    contract_types = ["Titular", "Suplente", "Interino", "Contratado", "Temporario", "Reemplazo", "Carga Horaria"]
    return {"contract_types": contract_types}


@router.get("/filters/departments")
async def get_all_departments(db: Session = Depends(get_db)):
    """Get all available departments for filtering"""
    service = ContestSearchService(db)
    return {"departments": service.get_all_departments()}
