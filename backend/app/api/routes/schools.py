from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.domain.repositories.repositories import SchoolRepository
from app.infrastructure.external_apis.google_maps_service import SchoolGeocodingService

router = APIRouter()


@router.get("/", response_model=List[dict])
async def get_schools(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all schools"""
    repo = SchoolRepository(db)
    schools = repo.get_all(skip, limit)
    
    return [
        {
            "id": school.id,
            "name": school.name,
            "city": school.city,
            "department": school.department,
            "address": school.address,
            "latitude": school.latitude,
            "longitude": school.longitude,
            "phone": school.phone,
            "email": school.email
        }
        for school in schools
    ]


@router.get("/{school_id}", response_model=dict)
async def get_school(school_id: int, db: Session = Depends(get_db)):
    """Get a specific school by ID"""
    repo = SchoolRepository(db)
    school = repo.get_by_id(school_id)
    
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    return {
        "id": school.id,
        "name": school.name,
        "city": school.city,
        "department": school.department,
        "address": school.address,
        "latitude": school.latitude,
        "longitude": school.longitude,
        "phone": school.phone,
        "email": school.email,
        "created_at": school.created_at.isoformat() if school.created_at else None,
        "updated_at": school.updated_at.isoformat() if school.updated_at else None
    }


@router.get("/city/{city}", response_model=List[dict])
async def get_schools_by_city(city: str, db: Session = Depends(get_db)):
    """Get schools by city"""
    repo = SchoolRepository(db)
    schools = repo.get_by_city(city)
    
    return [
        {
            "id": school.id,
            "name": school.name,
            "city": school.city,
            "department": school.department,
            "address": school.address,
            "latitude": school.latitude,
            "longitude": school.longitude
        }
        for school in schools
    ]


@router.get("/department/{department}", response_model=List[dict])
async def get_schools_by_department(department: str, db: Session = Depends(get_db)):
    """Get schools by department"""
    repo = SchoolRepository(db)
    schools = repo.get_by_department(department)
    
    return [
        {
            "id": school.id,
            "name": school.name,
            "city": school.city,
            "department": school.department,
            "address": school.address,
            "latitude": school.latitude,
            "longitude": school.longitude
        }
        for school in schools
    ]


@router.post("/{school_id}/geocode")
async def geocode_school(school_id: int, db: Session = Depends(get_db)):
    """Geocode a specific school address"""
    service = SchoolGeocodingService(db)
    
    success = await service.geocode_school(school_id)
    
    if success:
        return {"message": "School geocoded successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to geocode school")


@router.post("/geocode-all")
async def geocode_all_schools(db: Session = Depends(get_db)):
    """Geocode all schools that don't have coordinates"""
    service = SchoolGeocodingService(db)
    
    result = await service.geocode_all_schools()
    
    return {
        "message": "Geocoding completed",
        "total_schools": result["total"],
        "successful": result["success"],
        "errors": result["errors"]
    }
