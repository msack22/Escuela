from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from application.use_cases.contest_use_cases import ContestUseCasesImpl
from infrastructure.persistence.repositories.contest_repository_impl import ContestRepositoryImpl

router = APIRouter(prefix="/contests", tags=["contests"])

# Dependency injection
def get_contest_use_cases() -> ContestUseCasesImpl:
    """Get contest use cases instance"""
    repository = ContestRepositoryImpl()
    return ContestUseCasesImpl(repository)

@router.get("/")
async def get_contests(
    filters: Optional[Dict[str, Any]] = None,
    use_cases: ContestUseCasesImpl = Depends(get_contest_use_cases)
):
    """Get all contests with optional filters"""
    try:
        contests = await use_cases.get_all_contests(filters)
        return {
            "contests": contests,
            "total": len(contests),
            "filters": filters or {},
            "timestamp": "2024-03-14T22:35:00Z"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{contest_id}")
async def get_contest(
    contest_id: int,
    use_cases: ContestUseCasesImpl = Depends(get_contest_use_cases)
):
    """Get contest by ID"""
    try:
        contest = await use_cases.get_contest_by_id(contest_id)
        if not contest:
            raise HTTPException(status_code=404, detail="Contest not found")
        return contest
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
async def create_contest(
    contest_data: Dict[str, Any],
    use_cases: ContestUseCasesImpl = Depends(get_contest_use_cases)
):
    """Create a new contest"""
    try:
        created_contest = await use_cases.create_contest(contest_data)
        return created_contest
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{contest_id}")
async def update_contest(
    contest_id: int,
    contest_data: Dict[str, Any],
    use_cases: ContestUseCasesImpl = Depends(get_contest_use_cases)
):
    """Update an existing contest"""
    try:
        updated_contest = await use_cases.update_contest(contest_id, contest_data)
        if not updated_contest:
            raise HTTPException(status_code=404, detail="Contest not found")
        return updated_contest
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{contest_id}")
async def delete_contest(
    contest_id: int,
    use_cases: ContestUseCasesImpl = Depends(get_contest_use_cases)
):
    """Delete a contest"""
    try:
        success = await use_cases.delete_contest(contest_id)
        if not success:
            raise HTTPException(status_code=404, detail="Contest not found")
        return {"message": "Contest deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search/{query}")
async def search_contests(
    query: str,
    filters: Optional[Dict[str, Any]] = None,
    use_cases: ContestUseCasesImpl = Depends(get_contest_use_cases)
):
    """Search contests"""
    try:
        contests = await use_cases.search_contests(query, filters)
        return {
            "contests": contests,
            "total": len(contests),
            "query": query,
            "filters": filters or {},
            "timestamp": "2024-03-14T22:35:00Z"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
