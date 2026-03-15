"""
Sistema de notificaciones múltiples (Email únicamente)
"""

from typing import List, Dict, Any, Optional
from enum import Enum
import asyncio
import logging
from datetime import datetime
from dataclasses import dataclass

from app.infrastructure.notifications.email_notifier import EmailNotifier, EmailMessage
from app.infrastructure.notifications.base_notifier import BaseNotifier, NotificationMessage

class NotificationChannel(Enum):
    """Canales de notificación disponibles"""
    EMAIL = "email"
    BROWSER = "browser"  # Notificaciones en navegador
    BOTH = "both"

@dataclass
class NotificationResult:
    """Resultado de una notificación"""
    success: bool
    channel: NotificationChannel
    recipient: str
    message: str
    error: Optional[str] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

@dataclass
class MultiNotificationRequest:
    """Solicitud de notificación múltiple"""
    recipient_email: Optional[str] = None
    channels: List[NotificationChannel] = None
    message: str = ""
    subject: str = ""
    contest_data: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.channels is None:
            self.channels = [NotificationChannel.BOTH]

class MultiNotifier:
    """Sistema de notificaciones múltiples"""
    
    def __init__(self):
        self.email_notifier = EmailNotifier()
        self.logger = logging.getLogger(__name__)
    
    def is_available(self, channel: NotificationChannel) -> bool:
        """Verificar disponibilidad de un canal"""
        if channel == NotificationChannel.EMAIL:
            return self.email_notifier.is_available()
        elif channel == NotificationChannel.BROWSER:
            return True  # Browser notifications always available
        elif channel == NotificationChannel.BOTH:
            return self.email_notifier.is_available()
        return False
    
    def get_available_channels(self) -> List[NotificationChannel]:
        """Obtener canales disponibles"""
        available = []
        if self.email_notifier.is_available():
            available.append(NotificationChannel.EMAIL)
        available.append(NotificationChannel.BROWSER)  # Always available
        
        if len(available) == 2:
            available.append(NotificationChannel.BOTH)
        
        return available
    
    async def send_notification(self, request: MultiNotificationRequest) -> List[NotificationResult]:
        """Enviar notificación por múltiples canales"""
        results = []
        
        # Determinar canales a usar
        channels_to_use = []
        for channel in request.channels:
            if channel == NotificationChannel.BOTH:
                if request.recipient_email:
                    channels_to_use.append(NotificationChannel.EMAIL)
                channels_to_use.append(NotificationChannel.BROWSER)
            else:
                channels_to_use.append(channel)
        
        # Enviar notificaciones
        tasks = []
        for channel in channels_to_use:
            task = self._send_channel_notification(channel, request)
            tasks.append(task)
        
        if tasks:
            channel_results = await asyncio.gather(*tasks, return_exceptions=True)
            results.extend(channel_results)
        
        return results
    
    async def _send_channel_notification(self, channel: NotificationChannel, request: MultiNotificationRequest) -> NotificationResult:
        """Enviar notificación por un canal específico"""
        try:
            if channel == NotificationChannel.EMAIL:
                return await self._send_email_notification(request)
            elif channel == NotificationChannel.BROWSER:
                return await self._send_browser_notification(request)
            else:
                return NotificationResult(
                    success=False,
                    channel=channel,
                    recipient="",
                    message="Canal no soportado",
                    error="Canal no implementado"
                )
        except Exception as e:
            self.logger.error(f"Error sending notification via {channel.value}: {e}")
            return NotificationResult(
                success=False,
                channel=channel,
                recipient=request.recipient_email or "",
                message=request.message,
                error=str(e)
            )
    
    async def _send_email_notification(self, request: MultiNotificationRequest) -> NotificationResult:
        """Enviar notificación por email"""
        if not request.recipient_email:
            return NotificationResult(
                success=False,
                channel=NotificationChannel.EMAIL,
                recipient="",
                message=request.message,
                error="No se especificó email"
            )
        
        try:
            # Formatear email
            if request.contest_data:
                contest_data = request.contest_data.copy()
                contest_data['recipient_email'] = request.recipient_email
                success = await self.email_notifier.send_contest_notification(contest_data)
            else:
                email_message = EmailMessage(
                    to=request.recipient_email,
                    subject=request.subject,
                    body=request.message,
                    is_html=False
                )
                success = await self.email_notifier.send_email(email_message)
            
            return NotificationResult(
                success=success,
                channel=NotificationChannel.EMAIL,
                recipient=request.recipient_email,
                message=request.message,
                error=None if success else "Error al enviar email"
            )
            
        except Exception as e:
            return NotificationResult(
                success=False,
                channel=NotificationChannel.EMAIL,
                recipient=request.recipient_email,
                message=request.message,
                error=str(e)
            )
    
    async def _send_browser_notification(self, request: MultiNotificationRequest) -> NotificationResult:
        """Enviar notificación por navegador (simulado)"""
        # En un entorno real, esto podría usar WebSocket o Server-Sent Events
        print(f"Browser notification: {request.message}")
        return NotificationResult(
            success=True,
            channel=NotificationChannel.BROWSER,
            recipient="browser",
            message=request.message,
            error=None
        )
    
    def get_notification_summary(self, results: List[NotificationResult]) -> Dict[str, Any]:
        """Obtener resumen de resultados de notificación"""
        summary = {
            'total': len(results),
            'successful': 0,
            'failed': 0,
            'by_channel': {},
            'errors': []
        }
        
        for result in results:
            if result.success:
                summary['successful'] += 1
            else:
                summary['failed'] += 1
                if result.error:
                    summary['errors'].append({
                        'channel': result.channel.value,
                        'recipient': result.recipient,
                        'error': result.error
                    })
            
            channel_key = result.channel.value
            if channel_key not in summary['by_channel']:
                summary['by_channel'][channel_key] = {'sent': 0, 'failed': 0}
            
            if result.success:
                summary['by_channel'][channel_key]['sent'] += 1
            else:
                summary['by_channel'][channel_key]['failed'] += 1
        
        return summary

    async def send_test_notification(self, recipient_email: str = None, channels: List[NotificationChannel] = None) -> List[NotificationResult]:
        """Enviar notificación de prueba"""
        if channels is None:
            channels = [NotificationChannel.BOTH]
        
        test_contest_data = {
            'title': 'Concurso de Prueba - Matemática',
            'school_name': 'Escuela Secundaria N° 1',
            'school_city': 'Paraná',
            'school_department': 'Paraná',
            'subject_name': 'Matemática',
            'date': datetime.now().strftime('%Y-%m-%d'),
            'registration_deadline': (datetime.now().replace(day=datetime.now().day + 7)).strftime('%Y-%m-%d'),
            'level': 'Secundario',
            'shift': 'Mañana',
            'schedule': '08:00-12:00',
            'hours_to_cover': 20,
            'contract_type': 'Temporario',
            'description': 'Se busca profesor de matemática para cubrir cargo temporario. Requisitos: título docente, experiencia mínima 2 años.',
            'source_name': 'Test Source',
            'source_url': 'https://example.com/test-contest'
        }
        
        request = MultiNotificationRequest(
            recipient_email=recipient_email,
            channels=channels,
            message="Este es un mensaje de prueba del Sistema de Concursos Educativos",
            subject="🎓 Prueba de Notificación - Sistema de Concursos",
            contest_data=test_contest_data
        )
        
        return await self.send_notification(request)
    
    async def send_contest_notification(self, contest_data: Dict[str, Any], recipient_email: str = None, channels: List[NotificationChannel] = None) -> List[NotificationResult]:
        """Enviar notificación de concurso"""
        if channels is None:
            channels = [NotificationChannel.BOTH]
        
        request = MultiNotificationRequest(
            recipient_email=recipient_email,
            channels=channels,
            message=f"Nuevo concurso: {contest_data.get('title', 'Sin título')}",
            subject=f"🎓 Nuevo Concurso: {contest_data.get('title', 'Sin título')}",
            contest_data=contest_data
        )
        
        return await self.send_notification(request)

# Instancia global
multi_notifier = MultiNotifier()

# Funciones de conveniencia
async def send_multi_notification(recipient_email: str = None, message: str = "", contest_data: Dict[str, Any] = None, channels: List[NotificationChannel] = None) -> List[NotificationResult]:
    """Función de conveniencia para enviar notificación múltiple"""
    request = MultiNotificationRequest(
        recipient_email=recipient_email,
        channels=channels or [NotificationChannel.BOTH],
        message=message,
        subject=f"🎓 {message}" if message else "🎓 Notificación del Sistema",
        contest_data=contest_data
    )
    
    return await multi_notifier.send_notification(request)

async def send_contest_notification_multi(contest_data: Dict[str, Any], recipient_email: str = None) -> List[NotificationResult]:
    """Función de conveniencia para enviar notificación de concurso por múltiples canales"""
    return await multi_notifier.send_contest_notification(contest_data, recipient_email)
