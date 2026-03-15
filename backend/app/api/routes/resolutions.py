"""
API endpoints para gestión de resoluciones con chat integrado
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import json

from app.application.services.resolution_service import ResolutionService, ChatService
from app.core.database import get_db

router = APIRouter(prefix="/resolutions", tags=["resolutions"])

# Pydantic models
class ResolutionCreate(BaseModel):
    title: str
    description: str
    category: Optional[str] = None
    priority: str = 'medium'
    created_by: Optional[str] = None
    document_ids: Optional[List[int]] = None
    tag_ids: Optional[List[int]] = None

class ResolutionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None

class MessageCreate(BaseModel):
    content: str
    author: str
    message_type: str = 'user'

class DocumentCreate(BaseModel):
    title: str
    content: str
    file_type: str = 'text'

class TagCreate(BaseModel):
    name: str
    color: str = '#3B82F6'
    description: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    author: str

@router.post("/")
async def create_resolution(resolution: ResolutionCreate, db: Session = Depends(get_db)):
    """Crear nueva resolución"""
    try:
        service = ResolutionService(db)
        new_resolution = service.create_resolution(
            title=resolution.title,
            description=resolution.description,
            category=resolution.category,
            priority=resolution.priority,
            created_by=resolution.created_by,
            document_ids=resolution.document_ids,
            tag_ids=resolution.tag_ids
        )
        
        return {
            "success": True,
            "data": new_resolution.to_dict() if hasattr(new_resolution, 'to_dict') else {
                "id": new_resolution.id,
                "title": new_resolution.title,
                "status": new_resolution.status
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
def get_resolutions(
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Obtener lista de resoluciones"""
    try:
        service = ResolutionService(db)
        resolutions = service.get_resolutions(
            status=status,
            category=category,
            priority=priority,
            limit=limit,
            offset=offset
        )
        
        return {
            "success": True,
            "data": [res.to_dict() if hasattr(res, 'to_dict') else {
                "id": res.id,
                "title": res.title,
                "status": res.status,
                "category": res.category,
                "priority": res.priority,
                "created_at": res.created_at.isoformat() if res.created_at else None
            } for res in resolutions]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{resolution_id}")
def get_resolution(resolution_id: int, db: Session = Depends(get_db)):
    """Obtener resolución específica"""
    try:
        service = ResolutionService(db)
        resolution = service.get_resolution_by_id(resolution_id)
        
        if not resolution:
            raise HTTPException(status_code=404, detail="Resolución no encontrada")
        
        return {
            "success": True,
            "data": resolution.to_dict() if hasattr(resolution, 'to_dict') else {
                "id": resolution.id,
                "title": resolution.title,
                "description": resolution.description,
                "status": resolution.status,
                "category": resolution.category,
                "priority": resolution.priority,
                "created_at": resolution.created_at.isoformat() if resolution.created_at else None,
                "updated_at": resolution.updated_at.isoformat() if resolution.updated_at else None,
                "resolved_at": resolution.resolved_at.isoformat() if resolution.resolved_at else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{resolution_id}")
def update_resolution(resolution_id: int, resolution_update: ResolutionUpdate, db: Session = Depends(get_db)):
    """Actualizar resolución"""
    try:
        service = ResolutionService(db)
        updated_resolution = service.update_resolution(resolution_id, **resolution_update.dict(exclude_unset=True))
        
        if not updated_resolution:
            raise HTTPException(status_code=404, detail="Resolución no encontrada")
        
        return {
            "success": True,
            "data": updated_resolution.to_dict() if hasattr(updated_resolution, 'to_dict') else {
                "id": updated_resolution.id,
                "title": updated_resolution.title,
                "status": updated_resolution.status
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{resolution_id}/messages")
def get_resolution_messages(resolution_id: int, limit: int = 100, db: Session = Depends(get_db)):
    """Obtener mensajes de una resolución"""
    try:
        service = ResolutionService(db)
        messages = service.get_messages(resolution_id, limit)
        
        return {
            "success": True,
            "data": [msg.to_dict() if hasattr(msg, 'to_dict') else {
                "id": msg.id,
                "content": msg.content,
                "author": msg.author,
                "message_type": msg.message_type,
                "is_ai_response": msg.is_ai_response,
                "created_at": msg.created_at.isoformat() if msg.created_at else None
            } for msg in messages]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{resolution_id}/messages")
def add_message(resolution_id: int, message: MessageCreate, db: Session = Depends(get_db)):
    """Agregar mensaje a la conversación"""
    try:
        service = ResolutionService(db)
        new_message = service.add_message(
            resolution_id=resolution_id,
            content=message.content,
            author=message.author,
            message_type=message.message_type
        )
        
        return {
            "success": True,
            "data": new_message.to_dict() if hasattr(new_message, 'to_dict') else {
                "id": new_message.id,
                "content": new_message.content,
                "author": new_message.author
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{resolution_id}/chat")
async def chat_with_ai(resolution_id: int, chat_request: ChatRequest, db: Session = Depends(get_db)):
    """Enviar mensaje y obtener respuesta de IA"""
    try:
        chat_service = ChatService(db)
        response = await chat_service.process_message(
            resolution_id=resolution_id,
            message=chat_request.message,
            author=chat_request.author
        )
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/documents")
def upload_document(document: DocumentCreate, db: Session = Depends(get_db)):
    """Subir documento"""
    try:
        service = ResolutionService(db)
        new_document = service.upload_document(
            title=document.title,
            content=document.content,
            file_type=document.file_type
        )
        
        return {
            "success": True,
            "data": new_document.to_dict() if hasattr(new_document, 'to_dict') else {
                "id": new_document.id,
                "title": new_document.title,
                "file_type": new_document.file_type
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents")
def get_documents(resolution_id: Optional[int] = None, limit: int = 100, db: Session = Depends(get_db)):
    """Obtener documentos"""
    try:
        service = ResolutionService(db)
        documents = service.get_documents(resolution_id, limit)
        
        return {
            "success": True,
            "data": [doc.to_dict() if hasattr(doc, 'to_dict') else {
                "id": doc.id,
                "title": doc.title,
                "file_type": doc.file_type,
                "created_at": doc.created_at.isoformat() if doc.created_at else None
            } for doc in documents]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    resolution_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """Subir archivo de documento"""
    try:
        content = await file.read()
        
        service = ResolutionService(db)
        document = service.upload_document(
            title=title,
            content=content.decode('utf-8'),
            file_path=file.filename,
            file_type=file.content_type.split('/')[-1] if '/' in file.content_type else file.content_type
        )
        
        # Si se proporciona resolution_id, asociar el documento
        if resolution_id:
            resolution = service.get_resolution_by_id(resolution_id)
            if resolution:
                resolution.documents.append(document)
                db.commit()
        
        return {
            "success": True,
            "data": {
                "id": document.id,
                "title": document.title,
                "filename": file.filename,
                "size": len(content),
                "file_type": file.content_type
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tags")
def create_tag(tag: TagCreate, db: Session = Depends(get_db)):
    """Crear etiqueta"""
    try:
        service = ResolutionService(db)
        new_tag = service.create_tag(
            name=tag.name,
            color=tag.color,
            description=tag.description
        )
        
        return {
            "success": True,
            "data": new_tag.to_dict() if hasattr(new_tag, 'to_dict') else {
                "id": new_tag.id,
                "name": new_tag.name,
                "color": new_tag.color
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tags")
def get_tags(db: Session = Depends(get_db)):
    """Obtener todas las etiquetas"""
    try:
        service = ResolutionService(db)
        tags = service.get_tags()
        
        return {
            "success": True,
            "data": [tag.to_dict() if hasattr(tag, 'to_dict') else {
                "id": tag.id,
                "name": tag.name,
                "color": tag.color,
                "description": tag.description
            } for tag in tags]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search")
def search_resolutions(q: str, limit: int = 20, db: Session = Depends(get_db)):
    """Buscar resoluciones"""
    try:
        service = ResolutionService(db)
        resolutions = service.search_resolutions(q, limit)
        
        return {
            "success": True,
            "data": [res.to_dict() if hasattr(res, 'to_dict') else {
                "id": res.id,
                "title": res.title,
                "description": res.description[:100] + "..." if len(res.description) > 100 else res.description,
                "status": res.status,
                "created_at": res.created_at.isoformat() if res.created_at else None
            } for res in resolutions]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
def get_resolution_stats(db: Session = Depends(get_db)):
    """Obtener estadísticas de resoluciones"""
    try:
        service = ResolutionService(db)
        stats = service.get_resolution_stats()
        
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{resolution_id}")
def delete_resolution(resolution_id: int, db: Session = Depends(get_db)):
    """Eliminar resolución (soft delete - cambiar status a closed)"""
    try:
        service = ResolutionService(db)
        resolution = service.update_resolution(resolution_id, status='closed')
        
        if not resolution:
            raise HTTPException(status_code=404, detail="Resolución no encontrada")
        
        return {
            "success": True,
            "message": "Resolución cerrada exitosamente"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
