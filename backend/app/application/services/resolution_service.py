"""
Servicios para gestión de resoluciones con chat integrado
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
import json

from app.domain.models.resolution_models import Resolution, ResolutionMessage, Document, ResolutionTag
from app.core.database import get_db

class ResolutionService:
    """Servicio para gestión de resoluciones"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_resolution(self, title: str, description: str, category: str = None,
                     priority: str = 'medium', created_by: str = None,
                     document_ids: List[int] = None, tag_ids: List[int] = None) -> Resolution:
        """Crear nueva resolución"""
        resolution = Resolution(
            title=title,
            description=description,
            category=category,
            priority=priority,
            created_by=created_by,
            status='open'
        )
        
        self.db.add(resolution)
        self.db.commit()
        self.db.refresh(resolution)
        
        # Agregar documentos si se proporcionan
        if document_ids:
            for doc_id in document_ids:
                document = self.db.query(Document).filter(Document.id == doc_id).first()
                if document:
                    resolution.documents.append(document)
        
        # Agregar tags si se proporcionan
        if tag_ids:
            for tag_id in tag_ids:
                tag = self.db.query(ResolutionTag).filter(ResolutionTag.id == tag_id).first()
                if tag:
                    resolution.tags.append(tag)
        
        self.db.commit()
        
        # Agregar mensaje inicial del sistema
        self.add_message(
            resolution_id=resolution.id,
            content=f"Resolución '{title}' creada exitosamente",
            author='System',
            message_type='system'
        )
        
        return resolution
    
    def get_resolutions(self, status: Optional[str] = None, category: Optional[str] = None,
                      priority: Optional[str] = None, limit: int = 50,
                      offset: int = 0) -> List[Resolution]:
        """Obtener resoluciones con filtros"""
        query = self.db.query(Resolution)
        
        if status:
            query = query.filter(Resolution.status == status)
        if category:
            query = query.filter(Resolution.category == category)
        if priority:
            query = query.filter(Resolution.priority == priority)
        
        return query.order_by(Resolution.created_at.desc()).offset(offset).limit(limit).all()
    
    def get_resolution_by_id(self, resolution_id: int) -> Optional[Resolution]:
        """Obtener resolución por ID"""
        return self.db.query(Resolution).filter(Resolution.id == resolution_id).first()
    
    def update_resolution(self, resolution_id: int, **kwargs) -> Optional[Resolution]:
        """Actualizar resolución"""
        resolution = self.get_resolution_by_id(resolution_id)
        if not resolution:
            return None
        
        for key, value in kwargs.items():
            if hasattr(resolution, key):
                setattr(resolution, key, value)
        
        if 'status' in kwargs and kwargs['status'] == 'resolved':
            resolution.resolved_at = datetime.utcnow()
        
        resolution.updated_at = datetime.utcnow()
        self.db.commit()
        
        return resolution
    
    def add_message(self, resolution_id: int, content: str, author: str,
                   message_type: str = 'user', is_ai_response: bool = False,
                   ai_model: str = None, ai_confidence: str = None,
                   related_documents: List[int] = None) -> ResolutionMessage:
        """Agregar mensaje a la conversación"""
        message = ResolutionMessage(
            resolution_id=resolution_id,
            content=content,
            author=author,
            message_type=message_type,
            is_ai_response=is_ai_response,
            ai_model=ai_model,
            ai_confidence=ai_confidence,
            related_documents=json.dumps(related_documents) if related_documents else None
        )
        
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        
        return message
    
    def get_messages(self, resolution_id: int, limit: int = 100) -> List[ResolutionMessage]:
        """Obtener mensajes de una resolución"""
        return (self.db.query(ResolutionMessage)
                .filter(ResolutionMessage.resolution_id == resolution_id)
                .order_by(ResolutionMessage.created_at.asc())
                .limit(limit)
                .all())
    
    def upload_document(self, title: str, content: str, file_path: str = None,
                     file_type: str = 'text') -> Document:
        """Subir documento a la base de datos"""
        document = Document(
            title=title,
            content=content,
            file_path=file_path,
            file_type=file_type
        )
        
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        
        return document
    
    def get_documents(self, resolution_id: Optional[int] = None, limit: int = 100) -> List[Document]:
        """Obtener documentos"""
        query = self.db.query(Document)
        
        if resolution_id:
            # Obtener documentos asociados a una resolución
            resolution = self.get_resolution_by_id(resolution_id)
            if resolution:
                return resolution.documents
        
        return query.order_by(Document.created_at.desc()).limit(limit).all()
    
    def create_tag(self, name: str, color: str = '#3B82F6', description: str = None) -> ResolutionTag:
        """Crear etiqueta"""
        tag = ResolutionTag(
            name=name,
            color=color,
            description=description
        )
        
        self.db.add(tag)
        self.db.commit()
        self.db.refresh(tag)
        
        return tag
    
    def get_tags(self) -> List[ResolutionTag]:
        """Obtener todas las etiquetas"""
        return self.db.query(ResolutionTag).order_by(ResolutionTag.name).all()
    
    def search_resolutions(self, query: str, limit: int = 20) -> List[Resolution]:
        """Buscar resoluciones por texto"""
        return (self.db.query(Resolution)
                .filter(
                    (Resolution.title.contains(query)) |
                    (Resolution.description.contains(query))
                )
                .order_by(Resolution.created_at.desc())
                .limit(limit)
                .all())
    
    def get_resolution_stats(self) -> Dict[str, Any]:
        """Obtener estadísticas de resoluciones"""
        total = self.db.query(Resolution).count()
        open_count = self.db.query(Resolution).filter(Resolution.status == 'open').count()
        in_progress = self.db.query(Resolution).filter(Resolution.status == 'in_progress').count()
        resolved = self.db.query(Resolution).filter(Resolution.status == 'resolved').count()
        
        return {
            'total': total,
            'open': open_count,
            'in_progress': in_progress,
            'resolved': resolved,
            'resolution_rate': (resolved / total * 100) if total > 0 else 0
        }


class ChatService:
    """Servicio de chat con IA para resoluciones"""
    
    def __init__(self, db: Session):
        self.db = db
        self.resolution_service = ResolutionService(db)
    
    async def process_message(self, resolution_id: int, message: str, author: str) -> Dict[str, Any]:
        """Procesar mensaje y generar respuesta de IA si es necesario"""
        # Guardar mensaje del usuario
        user_message = self.resolution_service.add_message(
            resolution_id=resolution_id,
            content=message,
            author=author,
            message_type='user'
        )
        
        # Obtener contexto de la resolución
        resolution = self.resolution_service.get_resolution_by_id(resolution_id)
        if not resolution:
            return {
                'success': False,
                'error': 'Resolución no encontrada'
            }
        
        # Obtener mensajes anteriores para contexto
        messages = self.resolution_service.get_messages(resolution_id, limit=10)
        
        # Generar respuesta de IA (simulado por ahora)
        ai_response = await self._generate_ai_response(
            message=message,
            resolution=resolution,
            conversation_history=messages
        )
        
        # Guardar respuesta de IA
        ai_message = self.resolution_service.add_message(
            resolution_id=resolution_id,
            content=ai_response['content'],
            author='AI Assistant',
            message_type='ai',
            is_ai_response=True,
            ai_model=ai_response.get('model', 'gpt-3.5-turbo'),
            ai_confidence=ai_response.get('confidence', 'medium'),
            related_documents=ai_response.get('related_documents', [])
        )
        
        return {
            'success': True,
            'user_message': user_message.to_dict(),
            'ai_message': ai_message.to_dict(),
            'resolution': resolution.to_dict()
        }
    
    async def _generate_ai_response(self, message: str, resolution: Resolution, 
                                conversation_history: List[ResolutionMessage]) -> Dict[str, Any]:
        """Generar respuesta de IA (simulado)"""
        # En un entorno real, aquí se llamaría a una API de IA
        # Por ahora, simulamos respuestas inteligentes
        
        context = f"""
        Resolución: {resolution.title}
        Descripción: {resolution.description}
        Estado: {resolution.status}
        Categoría: {resolution.category}
        
        Mensaje del usuario: {message}
        
        Historial reciente:
        {chr(10).join([f"{msg.author}: {msg.content}" for msg in conversation_history[-5:]])}
        """
        
        # Simular diferentes tipos de respuestas según el contexto
        if any(keyword in message.lower() for keyword in ['ayuda', 'help', 'qué hago']):
            return {
                'content': f"Para ayudarte con la resolución '{resolution.title}', puedo:\n\n1. Revisar la documentación relacionada\n2. Analizar el estado actual\n3. Sugerir próximos pasos\n\n¿En qué aspecto específico necesitas ayuda?",
                'model': 'gpt-3.5-turbo',
                'confidence': 'high',
                'related_documents': []
            }
        
        elif any(keyword in message.lower() for keyword in ['estado', 'status', 'cómo va']):
            return {
                'content': f"La resolución '{resolution.title}' está actualmente en estado '{resolution.status}'.\n\nCategoría: {resolution.category or 'Sin categorizar'}\nPrioridad: {resolution.priority}\nÚltima actualización: {resolution.updated_at.strftime('%d/%m/%Y %H:%M') if resolution.updated_at else 'N/A'}",
                'model': 'gpt-3.5-turbo',
                'confidence': 'high',
                'related_documents': []
            }
        
        elif any(keyword in message.lower() for keyword in ['documentos', 'archivos', 'files']):
            docs = resolution.documents if resolution.documents else []
            if docs:
                doc_list = '\n'.join([f"• {doc.title} ({doc.file_type})" for doc in docs])
                return {
                    'content': f"Documentos asociados a esta resolución:\n\n{doc_list}\n\nHay {len(docs)} documentos en total. ¿Necesitas ver alguno en específico?",
                    'model': 'gpt-3.5-turbo',
                    'confidence': 'medium',
                    'related_documents': [doc.id for doc in docs]
                }
            else:
                return {
                    'content': "No hay documentos asociados a esta resolución. ¿Deseas subir algún archivo?",
                    'model': 'gpt-3.5-turbo',
                    'confidence': 'medium',
                    'related_documents': []
                }
        
        else:
            return {
                'content': f"He analizado tu mensaje sobre la resolución '{resolution.title}'. Basado en el contexto actual, te sugiero:\n\n1. Revisar la información disponible\n2. Considerar el estado: {resolution.status}\n3. Evaluar los próximos pasos necesarios\n\n¿Hay algo específico en lo que pueda ayudarte?",
                'model': 'gpt-3.5-turbo',
                'confidence': 'medium',
                'related_documents': []
            }
