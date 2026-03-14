from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.application.services.diploma_search_service import DiplomaSearchService, DiplomaFilter

router = APIRouter()


@router.get("/", response_model=dict)
async def get_diplomas(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    subject_id: Optional[int] = Query(None),
    city: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    start_date_from: Optional[datetime] = Query(None),
    start_date_to: Optional[datetime] = Query(None),
    institution_name: Optional[str] = Query(None),
    title_contains: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    # Additional filters
    modality: Optional[str] = Query(None),
    target_audience: Optional[str] = Query(None),
    has_scholarship: Optional[bool] = Query(None),
    level: Optional[str] = Query(None),
    min_price: Optional[int] = Query(None),
    max_price: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get diplomas with optional filters"""
    service = DiplomaSearchService(db)
    
    filters = DiplomaFilter(
        subject_id=subject_id,
        city=city,
        department=department,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        institution_name=institution_name,
        title_contains=title_contains,
        is_active=is_active,
        modality=modality,
        target_audience=target_audience,
        has_scholarship=has_scholarship,
        level=level,
        min_price=min_price,
        max_price=max_price
    )
    
    result = service.search_diplomas(filters, skip, limit)
    return result


@router.get("/{diploma_id}", response_model=dict)
async def get_diploma(diploma_id: int, db: Session = Depends(get_db)):
    """Get a specific diploma by ID"""
    service = DiplomaSearchService(db)
    diploma = service.get_diploma_by_id(diploma_id)
    
    if not diploma:
        raise HTTPException(status_code=404, detail="Diploma not found")
    
    return diploma


@router.get("/statistics/summary")
async def get_diploma_statistics(db: Session = Depends(get_db)):
    """Get diploma statistics"""
    service = DiplomaSearchService(db)
    return service.get_diploma_statistics()


@router.get("/filters/subjects")
async def get_all_subjects(db: Session = Depends(get_db)):
    """Get all available subjects for filtering"""
    service = DiplomaSearchService(db)
    return service.get_all_subjects()


@router.get("/filters/cities")
async def get_all_cities(db: Session = Depends(get_db)):
    """Get all available cities for filtering"""
    service = DiplomaSearchService(db)
    return service.get_all_cities()


@router.delete("/clear")
async def clear_all_diplomas(db: Session = Depends(get_db)):
    """Clear all diplomas (temporary endpoint for testing)"""
    try:
        # Delete all diplomas
        from app.domain.models.models import Diploma
        db.query(Diploma).delete()
        db.commit()
        return {"message": "All diplomas cleared successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
