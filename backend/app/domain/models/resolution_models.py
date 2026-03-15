"""
Sistema de gestión de resoluciones con chat integrado
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from typing import List, Optional
import json

Base = declarative_base()

# Tabla de asociación muchos-a-muchos entre resoluciones y documentos
resolution_documents = Table(
    'resolution_documents',
    Base.metadata,
    Column('resolution_id', Integer, ForeignKey('resolutions.id'), primary_key=True),
    Column('document_id', Integer, ForeignKey('documents.id'), primary_key=True)
)

class Document(Base):
    """Documento asociado a una resolución"""
    __tablename__ = 'documents'
    
    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    file_path = Column(String(500))
    file_type = Column(String(50))  # pdf, doc, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    resolutions = relationship("Resolution", secondary=resolution_documents, back_populates="documents")

class Resolution(Base):
    """Resolución o conversación sobre documentos"""
    __tablename__ = 'resolutions'
    
    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default='open')  # open, in_progress, resolved, closed
    priority = Column(String(20), default='medium')  # low, medium, high, urgent
    category = Column(String(100))  # administrativa, pedagógica, financiera, etc.
    
    # Fechas importantes
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime)
    
    # Campos de auditoría
    created_by = Column(String(100))
    assigned_to = Column(String(100))
    
    # Relaciones
    documents = relationship("Document", secondary=resolution_documents, back_populates="resolutions")
    messages = relationship("ResolutionMessage", back_populates="resolution", cascade="all, delete-orphan")

class ResolutionMessage(Base):
    """Mensajes del chat de la resolución"""
    __tablename__ = 'resolution_messages'
    
    id = Column(Integer, primary_key=True)
    resolution_id = Column(Integer, ForeignKey('resolutions.id'), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default='user')  # user, system, ai
    
    # Metadatos del mensaje
    created_at = Column(DateTime, default=datetime.utcnow)
    author = Column(String(100), nullable=False)
    is_ai_response = Column(Boolean, default=False)
    
    # Para respuestas de IA
    ai_model = Column(String(50))
    ai_confidence = Column(String(20))
    related_documents = Column(Text)  # JSON con IDs de documentos relacionados
    
    # Relación
    resolution = relationship("Resolution", back_populates="messages")

class ResolutionTag(Base):
    """Etiquetas para clasificar resoluciones"""
    __tablename__ = 'resolution_tags'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)
    color = Column(String(7))  # Código de color hexadecimal
    description = Column(Text)
    
    # Relaciones
    resolutions = relationship("Resolution", secondary="resolution_tag_associations")

# Tabla de asociación muchos-a-muchos
resolution_tag_associations = Table(
    'resolution_tag_associations',
    Base.metadata,
    Column('resolution_id', Integer, ForeignKey('resolutions.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('resolution_tags.id'), primary_key=True)
)

# Actualizar modelo Resolution para incluir relación con tags
Resolution.tags = relationship("ResolutionTag", secondary=resolution_tag_associations, back_populates="resolutions")
