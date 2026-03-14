"""
API Routes para Capacitaciones y Consultas de Resoluciones
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.database import get_db
from app.domain.models.capacitacion_models import Capacitacion, Resolucion
from app.infrastructure.scrapers.capacitaciones_scraper import CapacitacionesScraperFactory
from app.application.services.resolucion_chat_service import ResolucionChatService

router = APIRouter()

# Pydantic models
class CapacitacionResponse(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str]
    institucion: Optional[str]
    modalidad: Optional[str]
    duracion: Optional[str]
    fecha_inicio: Optional[datetime]
    fecha_fin: Optional[datetime]
    fecha_limite_inscripcion: Optional[datetime]
    precio: Optional[float]
    moneda: str = "ARS"
    beca_disponible: bool = False
    puntaje_asignado: Optional[float]
    tipo_certificado: Optional[str]
    horas_catedra: Optional[float]
    url_inscripcion: Optional[str]
    email_contacto: Optional[str]
    telefono_contacto: Optional[str]
    provincia: Optional[str]
    ciudad: Optional[str]
    direccion: Optional[str]
    nivel_educativo: Optional[str]
    destinatarios: Optional[str]
    fuente: str
    url_fuente: Optional[str]
    fecha_scraping: datetime
    activa: bool = True
    
    class Config:
        from_attributes = True


class CapacitacionCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=500)
    descripcion: Optional[str] = None
    institucion: Optional[str] = None
    modalidad: Optional[str] = None
    duracion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    fecha_limite_inscripcion: Optional[datetime] = None
    precio: Optional[float] = Field(None, ge=0)
    moneda: str = "ARS"
    beca_disponible: bool = False
    puntaje_asignado: Optional[float] = Field(None, ge=0)
    tipo_certificado: Optional[str] = None
    horas_catedra: Optional[float] = Field(None, ge=0)
    url_inscripcion: Optional[str] = None
    email_contacto: Optional[str] = None
    telefono_contacto: Optional[str] = None
    provincia: str = "Entre Ríos"
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    nivel_educativo: Optional[str] = None
    destinatarios: Optional[str] = None
    fuente: str
    url_fuente: Optional[str] = None


class ConsultaRequest(BaseModel):
    pregunta: str = Field(..., min_length=5, max_length=1000)
    session_id: str = Field(..., min_length=1, max_length=100)


class ConsultaResponse(BaseModel):
    respuesta: str
    resoluciones_encontradas: List[Dict[str, Any]] = []
    resolucion_principal: Optional[Dict[str, Any]] = None
    sugerencias: List[str] = []
    error: Optional[str] = None


class CalificacionRequest(BaseModel):
    consulta_id: int
    calificacion: int = Field(..., ge=1, le=5)
    feedback: Optional[str] = None


class ResolucionResponse(BaseModel):
    id: int
    numero: str
    anio: int
    titulo: str
    organismo_emisor: Optional[str]
    fecha_emision: Optional[datetime]
    tipo_resolucion: Optional[str]
    resumen: Optional[str]
    texto_completo: Optional[str]
    palabras_clave: Optional[str]
    nivel_educativo: Optional[str]
    tema_principal: Optional[str]
    subtemas: Optional[str]
    url_documento: Optional[str]
    formato_documento: Optional[str]
    fuente: str
    fecha_scraping: datetime
    ultima_actualizacion: Optional[datetime]
    
    class Config:
        from_attributes = True


# Capacitaciones endpoints
@router.get("/capacitaciones", response_model=List[CapacitacionResponse])
async def get_capacitaciones(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    nivel_educativo: Optional[str] = None,
    modalidad: Optional[str] = None,
    provincia: Optional[str] = None,
    ciudad: Optional[str] = None,
    precio_min: Optional[float] = None,
    precio_max: Optional[float] = None,
    con_puntaje: bool = False,
    activas: bool = True,
    db: Session = Depends(get_db)
):
    """Obtener lista de capacitaciones con filtros"""
    query = db.query(Capacitacion)
    
    # Aplicar filtros
    if activas:
        query = query.filter(Capacitacion.activa == True)
    
    if nivel_educativo:
        query = query.filter(Capacitacion.nivel_educativo.ilike(f"%{nivel_educativo}%"))
    
    if modalidad:
        query = query.filter(Capacitacion.modalidad.ilike(f"%{modalidad}%"))
    
    if provincia:
        query = query.filter(Capacitacion.provincia.ilike(f"%{provincia}%"))
    
    if ciudad:
        query = query.filter(Capacitacion.ciudad.ilike(f"%{ciudad}%"))
    
    if precio_min is not None:
        query = query.filter(Capacitacion.precio >= precio_min)
    
    if precio_max is not None:
        query = query.filter(Capacitacion.precio <= precio_max)
    
    if con_puntaje:
        query = query.filter(Capacitacion.puntaje_asignado.isnot(None))
    
    # Ordenar por fecha de scraping descendente
    query = query.order_by(Capacitacion.fecha_scraping.desc())
    
    # Paginación
    capacitaciones = query.offset(skip).limit(limit).all()
    
    return capacitaciones


@router.get("/capacitaciones/{capacitacion_id}", response_model=CapacitacionResponse)
async def get_capacitacion(capacitacion_id: int, db: Session = Depends(get_db)):
    """Obtener detalles de una capacitación específica"""
    capacitacion = db.query(Capacitacion).filter(Capacitacion.id == capacitacion_id).first()
    
    if not capacitacion:
        raise HTTPException(status_code=404, detail="Capacitación no encontrada")
    
    return capacitacion


@router.post("/capacitaciones", response_model=CapacitacionResponse)
async def create_capacitacion(
    capacitacion: CapacitacionCreate,
    db: Session = Depends(get_db)
):
    """Crear una nueva capacitación"""
    db_capacitacion = Capacitacion(**capacitacion.dict())
    db.add(db_capacitacion)
    db.commit()
    db.refresh(db_capacitacion)
    
    return db_capacitacion


@router.post("/capacitaciones/scrape")
async def scrape_capacitaciones(db: Session = Depends(get_db)):
    """Ejecutar scraping de capacitaciones desde todas las fuentes"""
    try:
        factory = CapacitacionesScraperFactory()
        scraped_capacitaciones = await factory.scrape_all_capacitaciones()
        
        capacitaciones_guardadas = 0
        
        for scraped in scraped_capacitaciones:
            # Verificar si ya existe
            existente = db.query(Capacitacion).filter(
                Capacitacion.titulo == scraped.titulo,
                Capacitacion.fuente == scraped.fuente
            ).first()
            
            if not existente:
                db_capacitacion = Capacitacion(
                    titulo=scraped.titulo,
                    descripcion=scraped.descripcion,
                    institucion=scraped.institucion,
                    modalidad=scraped.modalidad,
                    duracion=scraped.duracion,
                    fecha_inicio=scraped.fecha_inicio,
                    fecha_fin=scraped.fecha_fin,
                    fecha_limite_inscripcion=scraped.fecha_limite_inscripcion,
                    precio=scraped.precio,
                    moneda=scraped.moneda,
                    beca_disponible=scraped.beca_disponible,
                    puntaje_asignado=scraped.puntaje_asignado,
                    tipo_certificado=scraped.tipo_certificado,
                    horas_catedra=scraped.horas_catedra,
                    url_inscripcion=scraped.url_inscripcion,
                    email_contacto=scraped.email_contacto,
                    telefono_contacto=scraped.telefono_contacto,
                    provincia=scraped.provincia,
                    ciudad=scraped.ciudad,
                    direccion=scraped.direccion,
                    nivel_educativo=scraped.nivel_educativo,
                    destinatarios=scraped.destinatarios,
                    fuente=scraped.fuente,
                    url_fuente=scraped.url_fuente,
                    fecha_scraping=datetime.utcnow()
                )
                
                db.add(db_capacitacion)
                capacitaciones_guardadas += 1
        
        db.commit()
        
        return {
            "mensaje": "Scraping completado exitosamente",
            "capacitaciones_encontradas": len(scraped_capacitaciones),
            "capacitaciones_guardadas": capacitaciones_guardadas
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en scraping: {str(e)}")


@router.get("/capacitaciones/statistics")
async def get_capacitaciones_statistics(db: Session = Depends(get_db)):
    """Obtener estadísticas de capacitaciones"""
    try:
        total = db.query(Capacitacion).count()
        activas = db.query(Capacitacion).filter(Capacitacion.activa == True).count()
        
        # Por modalidad
        modalidades = db.query(Capacitacion.modalidad, db.func.count(Capacitacion.id)).group_by(Capacitacion.modalidad).all()
        
        # Por nivel educativo
        niveles = db.query(Capacitacion.nivel_educativo, db.func.count(Capacitacion.id)).group_by(Capacitacion.nivel_educativo).all()
        
        # Con puntaje
        con_puntaje = db.query(Capacitacion).filter(Capacitacion.puntaje_asignado.isnot(None)).count()
        
        # Gratuitas vs pagas
        gratuitas = db.query(Capacitacion).filter(Capacitacion.precio == 0).count()
        
        return {
            "total_capacitaciones": total,
            "capacitaciones_activas": activas,
            "capacitaciones_con_puntaje": con_puntaje,
            "capacitaciones_gratuitas": gratuitas,
            "capacitaciones_pagas": total - gratuitas,
            "por_modalidad": {modalidad: count for modalidad, count in modalidades if modalidad},
            "por_nivel_educativo": {nivel: count for nivel, count in niveles if nivel}
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo estadísticas: {str(e)}")


# Resoluciones endpoints
@router.get("/resoluciones", response_model=List[ResolucionResponse])
async def get_resoluciones(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    anio: Optional[int] = None,
    organismo: Optional[str] = None,
    nivel_educativo: Optional[str] = None,
    tema: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Obtener lista de resoluciones con filtros"""
    query = db.query(Resolucion)
    
    # Aplicar filtros
    if anio:
        query = query.filter(Resolucion.anio == anio)
    
    if organismo:
        query = query.filter(Resolucion.organismo_emisor.ilike(f"%{organismo}%"))
    
    if nivel_educativo:
        query = query.filter(Resolucion.nivel_educativo.ilike(f"%{nivel_educativo}%"))
    
    if tema:
        query = query.filter(Resolucion.tema_principal.ilike(f"%{tema}%"))
    
    # Ordenar por año descendente, luego por número
    query = query.order_by(Resolucion.anio.desc(), Resolucion.numero)
    
    # Paginación
    resoluciones = query.offset(skip).limit(limit).all()
    
    return resoluciones


@router.get("/resoluciones/{resolucion_id}", response_model=ResolucionResponse)
async def get_resolucion(resolucion_id: int, db: Session = Depends(get_db)):
    """Obtener detalles de una resolución específica"""
    resolucion = db.query(Resolucion).filter(Resolucion.id == resolucion_id).first()
    
    if not resolucion:
        raise HTTPException(status_code=404, detail="Resolución no encontrada")
    
    return resolucion


# Chat de resoluciones endpoints
@router.post("/resoluciones/consultar", response_model=ConsultaResponse)
async def consultar_resolucion(
    consulta: ConsultaRequest,
    db: Session = Depends(get_db)
):
    """Realizar consulta sobre resoluciones educativas"""
    chat_service = ResolucionChatService()
    
    respuesta = await chat_service.consultar_resolucion(
        db=db,
        pregunta=consulta.pregunta,
        session_id=consulta.session_id
    )
    
    return respuesta


@router.post("/resoluciones/calificar")
async def calificar_consulta(
    calificacion: CalificacionRequest,
    db: Session = Depends(get_db)
):
    """Calificar una consulta como útil o no"""
    chat_service = ResolucionChatService()
    
    exito = await chat_service.calificar_consulta(
        db=db,
        consulta_id=calificacion.consulta_id,
        calificacion=calificacion.calificacion,
        feedback=calificacion.feedback
    )
    
    if exito:
        return {"mensaje": "Consulta calificada exitosamente"}
    else:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")


@router.get("/resoluciones/estadisticas")
async def get_estadisticas_consultas(db: Session = Depends(get_db)):
    """Obtener estadísticas de consultas realizadas"""
    chat_service = ResolucionChatService()
    
    estadisticas = await chat_service.obtener_estadisticas_consultas(db)
    
    return estadisticas
