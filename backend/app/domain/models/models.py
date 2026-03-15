from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean, ForeignKey, VARCHAR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class School(Base):
    __tablename__ = "schools"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    city = Column(String(100), nullable=False, index=True)
    department = Column(String(100), nullable=False, index=True)
    address = Column(Text)
    latitude = Column(Float)
    longitude = Column(Float)
    phone = Column(String(50))
    email = Column(String(255))
    
    # Additional school information
    school_type = Column(String(100), nullable=True)  # público, privado, etc.
    school_number = Column(String(50), nullable=True)  # número de escuela
    principal_name = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    contests = relationship("Contest", back_populates="school")
    diplomas = relationship("Diploma", back_populates="school")


class Subject(Base):
    __tablename__ = "subjects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    contests = relationship("Contest", back_populates="subject")
    diplomas = relationship("Diploma", back_populates="subject")


class Diploma(Base):
    __tablename__ = "diplomas"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text)
    
    # Diploma specific information
    modality = Column(String(50), nullable=True, index=True)  # virtual, presencial, semipresencial
    duration = Column(String(100), nullable=True)  # ej: "3 meses", "120 horas"
    start_date = Column(DateTime(timezone=True), nullable=True, index=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    registration_deadline = Column(DateTime(timezone=True), nullable=True)
    
    # Educational level
    target_audience = Column(String(100), nullable=True, index=True)  # docentes, directivos, etc.
    level = Column(String(50), nullable=True, index=True)  # inicial, primario, secundario, etc.
    
    # Cost information
    price = Column(Integer, nullable=True)  # precio en pesos argentinos
    currency = Column(String(10), default="ARS")
    has_scholarship = Column(Boolean, default=False)
    scholarship_info = Column(Text, nullable=True)
    
    # Institution information
    institution_name = Column(String(255), nullable=False, index=True)
    institution_city = Column(String(100), nullable=False, index=True)
    institution_department = Column(String(100), nullable=False, index=True)
    institution_address = Column(Text, nullable=True)
    
    # Foreign Keys
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    
    # Contact information
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    contact_website = Column(String(500), nullable=True)
    
    # Source information
    source_url = Column(String(1000), nullable=False)
    source_name = Column(String(255), nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    is_processed = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    school = relationship("School", back_populates="diplomas")
    subject = relationship("Subject", back_populates="diplomas")


class Contest(Base):
    __tablename__ = "contests"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    registration_deadline = Column(DateTime(timezone=True))
    publication_date = Column(DateTime(timezone=True), nullable=True, index=True)  # Fecha de publicación original
    
    # Additional contest details
    level = Column(String(50), nullable=True, index=True)  # primaria, secundaria, inicial, etc.
    shift = Column(String(50), nullable=True, index=True)    # mañana, tarde, jornada completa
    schedule = Column(Text, nullable=True)                   # horarios específicos
    hours_to_cover = Column(Integer, nullable=True)            # cantidad de horas
    contract_type = Column(String(100), nullable=True)        # tipo de contrato
    
    # Foreign Keys
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    
    # Source information
    source_url = Column(String(1000), nullable=False)
    source_name = Column(String(255), nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    is_processed = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    school = relationship("School", back_populates="contests")
    subject = relationship("Subject", back_populates="contests")
    alerts = relationship("Alert", back_populates="contest")


class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_name = Column(String(255), nullable=False)
    whatsapp_number = Column(String(20), nullable=False)
    email_address = Column(String(255), nullable=True)  # Nuevo campo para email
    
    # Alert criteria
    subject_preferences = Column(Text)  # JSON string of preferred subjects
    max_distance_km = Column(Integer, default=50)
    
    # Notification preferences
    notification_channels = Column(String(50), default="both")  # "whatsapp", "email", "both"
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    contest_id = Column(Integer, ForeignKey("contests.id"), nullable=False)
    contest = relationship("Contest", back_populates="alerts")


class ScrapingLog(Base):
    __tablename__ = "scraping_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    source_name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False)  # success, error, partial
    contests_found = Column(Integer, default=0)
    contests_processed = Column(Integer, default=0)
    error_message = Column(Text)
    execution_time_seconds = Column(Float)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))
