"""
Modelo de datos para Capacitaciones y Resoluciones
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.domain.models.models import Base


class Capacitacion(Base):
    """Modelo para capacitaciones y cursos"""
    __tablename__ = "capacitaciones"
    
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(500), nullable=False, index=True)
    descripcion = Column(Text, nullable=True)
    institucion = Column(String(200), nullable=True, index=True)
    modalidad = Column(String(50), nullable=True)  # Presencial, Virtual, Híbrida
    duracion = Column(String(100), nullable=True)  # Ej: "40 horas", "2 meses"
    
    # Fechas importantes
    fecha_inicio = Column(DateTime, nullable=True, index=True)
    fecha_fin = Column(DateTime, nullable=True)
    fecha_limite_inscripcion = Column(DateTime, nullable=True, index=True)
    
    # Información de costo
    precio = Column(Float, nullable=True)
    moneda = Column(String(10), default="ARS")
    beca_disponible = Column(Boolean, default=False)
    
    # Puntaje y certificación
    puntaje_asignado = Column(Float, nullable=True)  # Puntaje para concursos/oposiciones
    tipo_certificado = Column(String(100), nullable=True)
    horas_catedra = Column(Float, nullable=True)
    
    # Información de inscripción
    url_inscripcion = Column(String(1000), nullable=True)
    email_contacto = Column(String(200), nullable=True)
    telefono_contacto = Column(String(100), nullable=True)
    
    # Ubicación
    provincia = Column(String(100), nullable=True, index=True)
    ciudad = Column(String(200), nullable=True, index=True)
    direccion = Column(String(500), nullable=True)
    
    # Nivel y destinatarios
    nivel_educativo = Column(String(100), nullable=True, index=True)  # Inicial, Primario, Secundario, Superior
    destinatarios = Column(Text, nullable=True)  # Docentes, directivos, etc.
    
    # Metadatos
    fuente = Column(String(100), nullable=False, index=True)  # Nombre del scraper
    url_fuente = Column(String(1000), nullable=True)
    fecha_scraping = Column(DateTime, default=datetime.utcnow)
    activa = Column(Boolean, default=True, index=True)
    
    # Relaciones
    requisitos = relationship("CapacitacionRequisito", back_populates="capacitacion", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Capacitacion(id={self.id}, titulo='{self.titulo[:50]}...', institucion='{self.institucion}')>"


class CapacitacionRequisito(Base):
    """Requisitos para capacitaciones"""
    __tablename__ = "capacitacion_requisitos"
    
    id = Column(Integer, primary_key=True, index=True)
    capacitacion_id = Column(Integer, ForeignKey("capacitaciones.id"), nullable=False)
    tipo_requisito = Column(String(100), nullable=False)  # Título, Experiencia, Documentación, etc.
    descripcion = Column(Text, nullable=False)
    obligatorio = Column(Boolean, default=True)
    
    # Relación
    capacitacion = relationship("Capacitacion", back_populates="requisitos")
    
    def __repr__(self):
        return f"<CapacitacionRequisito(capacitacion_id={self.capacitacion_id}, tipo='{self.tipo_requisito}')>"


class Resolucion(Base):
    """Modelo para resoluciones educativas"""
    __tablename__ = "resoluciones"
    
    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(100), nullable=False, index=True)  # Ej: "783/12", "2300/22"
    anio = Column(Integer, nullable=False, index=True)
    titulo = Column(String(500), nullable=False, index=True)
    
    # Información de emisión
    organismo_emisor = Column(String(200), nullable=True, index=True)  # CGE, Ministerio, etc.
    fecha_emision = Column(DateTime, nullable=True, index=True)
    tipo_resolucion = Column(String(100), nullable=True, index=True)  # Reglamento, Concurso, General
    
    # Contenido
    resumen = Column(Text, nullable=True)
    texto_completo = Column(Text, nullable=True)
    palabras_clave = Column(Text, nullable=True)  # Separadas por comas
    
    # Categorización
    nivel_educativo = Column(String(100), nullable=True, index=True)  # Inicial, Primario, Secundario, Superior
    tema_principal = Column(String(200), nullable=True, index=True)  # Concursos, Salarios, Reglamento
    subtemas = Column(Text, nullable=True)  # Subtemas separados por comas
    
    # Documento
    url_documento = Column(String(1000), nullable=True)
    formato_documento = Column(String(20), nullable=True)  # PDF, DOC, etc.
    tamaño_documento = Column(Integer, nullable=True)  # Tamaño en bytes
    
    # Metadatos
    fuente = Column(String(100), nullable=False, index=True)
    url_fuente = Column(String(1000), nullable=True)
    fecha_scraping = Column(DateTime, default=datetime.utcnow)
    ultima_actualizacion = Column(DateTime, nullable=True)
    
    # Indexación para búsqueda
    texto_indexado = Column(Text, nullable=True)  # Texto procesado para búsqueda full-text
    
    def __repr__(self):
        return f"<Resolucion(id={self.id}, numero='{self.numero}', titulo='{self.titulo[:50]}...')>"


class ConsultaResolucion(Base):
    """Registro de consultas sobre resoluciones"""
    __tablename__ = "consulta_resoluciones"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=False, index=True)
    pregunta_usuario = Column(Text, nullable=False)
    
    # Respuesta del sistema
    resolucion_id = Column(Integer, ForeignKey("resoluciones.id"), nullable=True)
    respuesta_generada = Column(Text, nullable=False)
    fragmento_relevante = Column(Text, nullable=True)
    
    # Metadatos
    fecha_consulta = Column(DateTime, default=datetime.utcnow, index=True)
    ip_usuario = Column(String(50), nullable=True)
    agente_usuario = Column(String(500), nullable=True)
    
    # Evaluación
    utilidad_calificacion = Column(Integer, nullable=True)  # 1-5 estrellas
    feedback_usuario = Column(Text, nullable=True)
    
    # Relación
    resolucion = relationship("Resolucion")
    
    def __repr__(self):
        return f"<ConsultaResolucion(id={self.id}, session_id='{self.session_id}', resolucion_id={self.resolucion_id})>"
