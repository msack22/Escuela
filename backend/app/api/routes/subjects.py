from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domain.repositories.repositories import SubjectRepository

router = APIRouter()


@router.get("/", response_model=list)
async def get_subjects(db: Session = Depends(get_db)):
    """Get all subjects"""
    repo = SubjectRepository(db)
    subjects = repo.get_all()
    
    return [
        {
            "id": subject.id,
            "name": subject.name,
            "description": subject.description
        }
        for subject in subjects
    ]


@router.get("/{subject_id}", response_model=dict)
async def get_subject(subject_id: int, db: Session = Depends(get_db)):
    """Get a specific subject by ID"""
    repo = SubjectRepository(db)
    subject = repo.get_by_id(subject_id)
    
    if not subject:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Subject not found")
    
    return {
        "id": subject.id,
        "name": subject.name,
        "description": subject.description,
        "created_at": subject.created_at.isoformat() if subject.created_at else None
    }
