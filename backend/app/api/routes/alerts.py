from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.application.services.alert_service import AlertService
from app.infrastructure.notifications.multi_notifier import multi_notifier, NotificationChannel

router = APIRouter()


class AlertCreate(BaseModel):
    user_name: str
    email_address: Optional[str] = None
    subject_preferences: List[str]
    max_distance_km: int = 50
    notification_channels: str = "both"  # "email", "browser", "both"


class AlertUpdate(BaseModel):
    user_name: Optional[str] = None
    email_address: Optional[str] = None
    subject_preferences: Optional[List[str]] = None
    max_distance_km: Optional[int] = None
    notification_channels: Optional[str] = None


class TestNotificationRequest(BaseModel):
    email_address: Optional[str] = None
    channels: List[str] = ["both"]  # ["email", "browser", "both"]


@router.post("/", response_model=dict)
async def create_alert(alert: AlertCreate, db: Session = Depends(get_db)):
    """Create a new alert"""
    service = AlertService(db)
    
    try:
        new_alert = service.create_alert(
            user_name=alert.user_name,
            email_address=alert.email_address,
            subject_preferences=alert.subject_preferences,
            max_distance_km=alert.max_distance_km
        )
        
        return {
            "id": new_alert.id,
            "user_name": new_alert.user_name,
            "email_address": new_alert.email_address,
            "subject_preferences": new_alert.subject_preferences,
            "max_distance_km": new_alert.max_distance_km,
            "is_active": new_alert.is_active,
            "created_at": new_alert.created_at.isoformat() if new_alert.created_at else None
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[dict])
async def get_active_alerts(db: Session = Depends(get_db)):
    """Get all active alerts"""
    service = AlertService(db)
    alerts = service.get_active_alerts()
    
    return [
        {
            "id": alert.id,
            "user_name": alert.user_name,
            "whatsapp_number": alert.whatsapp_number,
            "subject_preferences": alert.subject_preferences,
            "max_distance_km": alert.max_distance_km,
            "is_active": alert.is_active,
            "created_at": alert.created_at.isoformat() if alert.created_at else None
        }
        for alert in alerts
    ]


@router.put("/{alert_id}", response_model=dict)
async def update_alert(alert_id: int, alert_update: AlertUpdate, db: Session = Depends(get_db)):
    """Update an alert"""
    service = AlertService(db)
    
    update_data = {}
    if alert_update.user_name is not None:
        update_data['user_name'] = alert_update.user_name
    if alert_update.subject_preferences is not None:
        update_data['subject_preferences'] = alert_update.subject_preferences
    if alert_update.max_distance_km is not None:
        update_data['max_distance_km'] = alert_update.max_distance_km
    
    updated_alert = service.update_alert_preferences(alert_id, **update_data)
    
    if not updated_alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {
        "id": updated_alert.id,
        "user_name": updated_alert.user_name,
        "whatsapp_number": updated_alert.whatsapp_number,
        "subject_preferences": updated_alert.subject_preferences,
        "max_distance_km": updated_alert.max_distance_km,
        "is_active": updated_alert.is_active,
        "updated_at": updated_alert.updated_at.isoformat() if updated_alert.updated_at else None
    }


@router.delete("/{alert_id}")
async def deactivate_alert(alert_id: int, db: Session = Depends(get_db)):
    """Deactivate an alert"""
    service = AlertService(db)
    
    success = service.deactivate_alert(alert_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert deactivated successfully"}


@router.post("/test-notification")
async def send_test_notification(request: TestNotificationRequest, db: Session = Depends(get_db)):
    """Send a test notification via multiple channels"""
    try:
        # Convertir string channels a NotificationChannel enum
        notification_channels = []
        for channel_str in request.channels:
            if channel_str == "whatsapp":
                notification_channels.append(NotificationChannel.WHATSAPP)
            elif channel_str == "email":
                notification_channels.append(NotificationChannel.EMAIL)
            elif channel_str == "both":
                notification_channels.append(NotificationChannel.BOTH)
        
        # Enviar notificación de prueba
        results = await multi_notifier.send_test_notification(
            recipient_whatsapp=request.whatsapp_number,
            recipient_email=request.email_address,
            channels=notification_channels
        )
        
        # Obtener resumen
        summary = multi_notifier.get_notification_summary(results)
        
        return {
            "message": "Test notification sent",
            "summary": summary,
            "details": [
                {
                    "channel": result.channel.value,
                    "success": result.success,
                    "recipient": result.recipient,
                    "error": result.error
                }
                for result in results
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending test notification: {str(e)}")


@router.get("/notification-channels")
async def get_available_notification_channels():
    """Get available notification channels"""
    available_channels = multi_notifier.get_available_channels()
    all_channels = ["whatsapp", "email", "both"]
    
    return {
        "available": [channel.value for channel in available_channels],
        "all": all_channels,
        "status": {
            channel.value: multi_notifier.is_available(channel)
            for channel in [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL, NotificationChannel.BOTH]
        }
    }


@router.post("/send-multi")
async def send_multi_notification(
    recipient_whatsapp: Optional[str] = None,
    recipient_email: Optional[str] = None,
    message: str = "",
    channels: List[str] = ["both"],
    db: Session = Depends(get_db)
):
    """Send notification via multiple channels"""
    try:
        # Convertir string channels a NotificationChannel enum
        notification_channels = []
        for channel_str in channels:
            if channel_str == "whatsapp":
                notification_channels.append(NotificationChannel.WHATSAPP)
            elif channel_str == "email":
                notification_channels.append(NotificationChannel.EMAIL)
            elif channel_str == "both":
                notification_channels.append(NotificationChannel.BOTH)
        
        # Enviar notificación
        results = await multi_notifier.send_notification(
            recipient_whatsapp=recipient_whatsapp,
            recipient_email=recipient_email,
            channels=notification_channels,
            message=message
        )
        
        # Obtener resumen
        summary = multi_notifier.get_notification_summary(results)
        
        return {
            "message": "Notification sent",
            "summary": summary,
            "details": [
                {
                    "channel": result.channel.value,
                    "success": result.success,
                    "recipient": result.recipient,
                    "error": result.error,
                    "timestamp": result.timestamp.isoformat()
                }
                for result in results
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending notification: {str(e)}")
