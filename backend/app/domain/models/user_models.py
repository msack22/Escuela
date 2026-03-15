from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    is_admin = Column(Boolean, default=False)
    notification_days_ahead = Column(Integer, default=3)  # Días de antelación para notificaciones
    created_at = Column(DateTime(timezone=True), server_default='func.now()')
    updated_at = Column(DateTime(timezone=True), onupdate='func.now()')
    
    # Relationships
    alerts = relationship("Alert", back_populates="user")
    notifications = relationship("Notification", back_populates="user")

class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    filters = Column(Text)  # JSON con filtros de búsqueda guardados
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default='func.now()')
    updated_at = Column(DateTime(timezone=True), onupdate='func.now()')
    
    # Relationships
    user = relationship("User", back_populates="alerts")
    notifications = relationship("Notification", back_populates="alert")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False)
    contest_id = Column(Integer, ForeignKey("contests.id"), nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default='func.now()')
    status = Column(String(50), default='sent')  # sent, failed, pending
    error_message = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="notifications")
    alert = relationship("Alert", back_populates="notifications")
    contest = relationship("Contest", back_populates="notifications")
