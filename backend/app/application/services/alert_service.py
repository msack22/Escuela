from typing import List, Dict, Any, Optional
import json
import logging
from sqlalchemy.orm import Session

from app.domain.models.models import Alert, Contest
from app.domain.repositories.repositories import AlertRepository, ContestRepository
from app.infrastructure.notifications.base_notifier import BaseNotifier, NotificationMessage
from app.infrastructure.notifications.whatsapp_notifier import WhatsAppNotifier
from app.core.config import settings

logger = logging.getLogger(__name__)


class AlertService:
    """Service for managing alerts and notifications following Observer Pattern"""
    
    def __init__(self, db: Session):
        self.db = db
        self.alert_repo = AlertRepository(db)
        self.contest_repo = ContestRepository(db)
        self.notifiers: List[BaseNotifier] = []
        self._initialize_notifiers()
    
    def _initialize_notifiers(self):
        """Initialize available notification services"""
        whatsapp_notifier = WhatsAppNotifier()
        if whatsapp_notifier.is_configured():
            self.notifiers.append(whatsapp_notifier)
            logger.info("WhatsApp notifier initialized")
        else:
            logger.warning("WhatsApp notifier not configured")
    
    def create_alert(self, user_name: str, whatsapp_number: str, 
                    subject_preferences: List[str], max_distance_km: int = 50) -> Alert:
        """Create a new alert"""
        alert = Alert(
            user_name=user_name,
            whatsapp_number=whatsapp_number,
            subject_preferences=json.dumps(subject_preferences),
            max_distance_km=max_distance_km,
            is_active=True
        )
        return self.alert_repo.create(alert)
    
    def get_active_alerts(self) -> List[Alert]:
        """Get all active alerts"""
        return self.alert_repo.get_active_alerts()
    
    async def check_and_send_notifications(self, contest: Contest) -> int:
        """Check contest against active alerts and send notifications"""
        notifications_sent = 0
        active_alerts = self.get_active_alerts()
        
        for alert in active_alerts:
            if self._should_notify(alert, contest):
                success = await self._send_notification(alert, contest)
                if success:
                    notifications_sent += 1
                    # Create alert record
                    alert_record = Alert(
                        user_name=alert.user_name,
                        whatsapp_number=alert.whatsapp_number,
                        subject_preferences=alert.subject_preferences,
                        max_distance_km=alert.max_distance_km,
                        contest_id=contest.id
                    )
                    self.alert_repo.create(alert_record)
        
        return notifications_sent
    
    def _should_notify(self, alert: Alert, contest: Contest) -> bool:
        """Check if alert should be triggered for this contest"""
        try:
            # Check subject preferences
            subject_preferences = json.loads(alert.subject_preferences or '[]')
            if subject_preferences and contest.subject.name not in subject_preferences:
                return False
            
            # Check distance if school has coordinates
            if (contest.school.latitude and contest.school.longitude and 
                alert.max_distance_km and alert.max_distance_km > 0):
                
                distance = self._calculate_distance(
                    settings.user_latitude,
                    settings.user_longitude,
                    contest.school.latitude,
                    contest.school.longitude
                )
                
                if distance > alert.max_distance_km:
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking notification criteria: {e}")
            return False
    
    async def _send_notification(self, alert: Alert, contest: Contest) -> bool:
        """Send notification for alert"""
        try:
            # Prepare contest data
            contest_data = {
                'title': contest.title,
                'description': contest.description,
                'date': contest.date.isoformat() if contest.date else None,
                'registration_deadline': contest.registration_deadline.isoformat() if contest.registration_deadline else None,
                'subject': {
                    'name': contest.subject.name,
                    'description': contest.subject.description
                },
                'school': {
                    'name': contest.school.name,
                    'city': contest.school.city,
                    'department': contest.school.department,
                    'address': contest.school.address,
                    'latitude': contest.school.latitude,
                    'longitude': contest.school.longitude
                },
                'source': {
                    'name': contest.source_name,
                    'url': contest.source_url
                }
            }
            
            # Calculate distance if possible
            if (contest.school.latitude and contest.school.longitude):
                distance = self._calculate_distance(
                    settings.user_latitude,
                    settings.user_longitude,
                    contest.school.latitude,
                    contest.school.longitude
                )
                contest_data['distance_km'] = round(distance, 2)
            
            # Create notification message
            message = NotificationMessage(
                recipient=alert.whatsapp_number,
                subject=f"Nuevo Concurso: {contest.title}",
                message=f"Se ha encontrado un nuevo concurso que coincide con tus preferencias.",
                contest_data=contest_data
            )
            
            # Send through all available notifiers
            success_count = 0
            for notifier in self.notifiers:
                try:
                    success = await notifier.send_notification(message)
                    if success:
                        success_count += 1
                except Exception as e:
                    logger.error(f"Error sending notification via {notifier.__class__.__name__}: {e}")
            
            return success_count > 0
            
        except Exception as e:
            logger.error(f"Error sending notification: {e}")
            return False
    
    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two coordinates using Haversine formula"""
        import math
        
        # Convert latitude and longitude to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Radius of earth in kilometers
        r = 6371
        
        return c * r
    
    async def send_test_notification(self, whatsapp_number: str) -> bool:
        """Send a test notification"""
        message = NotificationMessage(
            recipient=whatsapp_number,
            subject="Test de Sistema de Alertas",
            message="Este es un mensaje de prueba del sistema de alertas de concursos educativos. ¡Funciona correctamente! 🎉"
        )
        
        for notifier in self.notifiers:
            try:
                success = await notifier.send_notification(message)
                if success:
                    return True
            except Exception as e:
                logger.error(f"Error sending test notification: {e}")
        
        return False
    
    def update_alert_preferences(self, alert_id: int, **kwargs) -> Optional[Alert]:
        """Update alert preferences"""
        alert = self.alert_repo.get_by_id(alert_id)
        if alert:
            for key, value in kwargs.items():
                if hasattr(alert, key):
                    if key == 'subject_preferences' and isinstance(value, list):
                        setattr(alert, key, json.dumps(value))
                    else:
                        setattr(alert, key, value)
            return self.alert_repo.update(alert)
        return None
    
    def deactivate_alert(self, alert_id: int) -> bool:
        """Deactivate an alert"""
        alert = self.alert_repo.get_by_id(alert_id)
        if alert:
            alert.is_active = False
            self.alert_repo.update(alert)
            return True
        return False
