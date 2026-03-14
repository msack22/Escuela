from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.core.database import get_db
from app.infrastructure.calendar_manager import CalendarManager, ScheduleConflict
from pydantic import BaseModel

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


class ScheduleRequest(BaseModel):
    """Modelo para solicitud de análisis de horarios"""
    schedule: List[Dict[str, Any]]  # Lista de días con horarios
    contests: List[Dict[str, Any]] = []  # Concursos a analizar (opcional)


class ConflictAnalysisResponse(BaseModel):
    """Respuesta del análisis de conflictos"""
    conflicts: List[Dict[str, Any]]
    conflict_report: str
    suggestions: List[str]
    has_conflicts: bool


class CalendarSyncRequest(BaseModel):
    """Modelo para solicitud de sincronización"""
    calendar_id: Optional[str] = None
    contests: List[Dict[str, Any]]


@router.post("/analyze-conflicts", response_model=ConflictAnalysisResponse)
async def analyze_conflicts(request: ScheduleRequest, db: Session = Depends(get_db)):
    """Analizar conflictos entre horario del usuario y concursos"""
    try:
        calendar_manager = CalendarManager()
        
        # Obtener concursos desde la base de datos
        from app.application.services.contest_search_service import ContestSearchService
        search_service = ContestSearchService(db)
        
        # Buscar concursos activos
        all_contests = []
        for source_name in ["educacion_gob", "consejo_entrerios", "facebook"]:
            try:
                from app.infrastructure.scrapers.scraper_factory import ScraperFactory
                scraper = ScraperFactory.create_scraper(source_name)
                if scraper.is_available():
                    contests = await scraper.scrape_contests()
                    all_contests.extend(contests)
            except Exception as e:
                print(f"Error scraping {source_name}: {e}")
        
        conflicts = calendar_manager.analyze_conflicts(request.schedule, all_contests)
        
        # Convertir conflictos a formato de respuesta
        conflict_dicts = []
        for conflict in conflicts:
            conflict_dicts.append({
                "contest_title": conflict.contest_title,
                "contest_date": conflict.contest_date.isoformat(),
                "contest_schedule": conflict.contest_schedule,
                "contest_hours": conflict.contest_hours,
                "user_schedule": conflict.user_schedule,
                "user_hours": conflict.user_hours,
                "conflict_type": conflict.conflict_type
            })
        
        suggestions = calendar_manager.suggest_optimizations(conflicts)
        
        return ConflictAnalysisResponse(
            conflicts=conflict_dicts,
            conflict_report=calendar_manager.generate_conflict_report(conflicts),
            suggestions=suggestions,
            has_conflicts=len(conflicts) > 0
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing conflicts: {str(e)}")


@router.post("/export-schedule", response_model=Dict[str, str])
async def export_schedule_to_csv(schedule: List[Dict[str, Any]]):
    """Exportar horario a formato CSV"""
    try:
        calendar_manager = CalendarManager()
        success = calendar_manager.export_schedule_to_csv(schedule)
        
        if success:
            return {"message": "Horario exportado exitosamente a my_schedule.csv"}
        else:
            return {"message": "Error exportando horario a CSV"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting schedule: {str(e)}")


@router.post("/import-schedule", response_model=Dict[str, str])
async def import_schedule_from_csv():
    """Importar horario desde formato CSV"""
    try:
        calendar_manager = CalendarManager()
        schedule = calendar_manager.import_schedule_from_csv()
        
        return {
            "message": "Horario importado exitosamente",
            "schedule": schedule
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error importing schedule: {str(e)}")


@router.get("/conflict-report", response_model=Dict[str, str])
async def get_conflict_report_example():
    """Obtener ejemplo de reporte de conflictos"""
    try:
        calendar_manager = CalendarManager()
        
        # Ejemplo de conflictos
        from datetime import datetime, timedelta
        example_conflicts = [
            ScheduleConflict(
                contest_title="Concurso de Matemática - Escuela N° 123",
                contest_date=datetime.now() + timedelta(days=7),
                contest_schedule="8:00 - 12:00",
                contest_hours=20,
                user_schedule="9:00 - 13:00",
                user_hours=20,
                conflict_type="conflicto_parcial"
            ),
            ScheduleConflict(
                contest_title="Concurso de Lengua - Escuela N° 456",
                contest_date=datetime.now() + timedelta(days=10),
                contest_schedule="14:00 - 18:00",
                contest_hours=15,
                user_schedule="14:00 - 16:00",
                user_hours=15,
                conflict_type="solapamiento"
            )
        ]
        
        report = calendar_manager.generate_conflict_report(example_conflicts)
        
        return {
            "report": report,
            "example_conflicts": [
                {
                    "contest_title": conflict.contest_title,
                    "contest_date": conflict.contest_date.isoformat(),
                    "contest_schedule": conflict.contest_schedule,
                    "contest_hours": conflict.contest_hours,
                    "user_schedule": conflict.user_schedule,
                    "user_hours": conflict.user_hours,
                    "conflict_type": conflict.conflict_type
                } for conflict in example_conflicts
            ]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating conflict report: {str(e)}")


@router.get("/suggestions", response_model=List[str])
async def get_conflict_suggestions():
    """Obtener sugerencias para manejo de conflictos"""
    try:
        calendar_manager = CalendarManager()
        
        # Ejemplos de conflictos para generar sugerencias
        from datetime import datetime, timedelta
        example_conflicts = [
            ScheduleConflict(
                contest_title="Concurso A",
                contest_date=datetime.now() + timedelta(days=5),
                contest_schedule="8:00 - 12:00",
                contest_hours=20,
                user_schedule="9:00 - 13:00",
                user_hours=20,
                conflict_type="conflicto_parcial"
            ),
            ScheduleConflict(
                contest_title="Concurso B",
                contest_date=datetime.now() + timedelta(days=7),
                contest_schedule="14:00 - 18:00",
                contest_hours=15,
                user_schedule="14:00 - 16:00",
                user_hours=15,
                conflict_type="solapamiento"
            )
        ]
        
        suggestions = calendar_manager.suggest_optimizations(example_conflicts)
        
        return suggestions
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting suggestions: {str(e)}")
