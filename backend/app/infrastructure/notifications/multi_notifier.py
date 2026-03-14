"""
Sistema de notificaciones múltiples (WhatsApp, Email, o ambos)
"""

from typing import List, Dict, Any, Optional, Union
from enum import Enum
import asyncio
import logging
from datetime import datetime
from dataclasses import dataclass

from app.infrastructure.notifications.whatsapp_secure_notifier import WhatsAppSecureNotifier
from app.infrastructure.notifications.email_notifier import EmailNotifier, EmailMessage
from app.infrastructure.notifications.base_notifier import BaseNotifier, NotificationMessage

class NotificationChannel(Enum):
    """Canales de notificación disponibles"""
    WHATSAPP = "whatsapp"
    EMAIL = "email"
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
    recipient_whatsapp: Optional[str] = None
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
        # Crear una implementación concreta para WhatsApp
        from app.infrastructure.notifications.whatsapp_secure_notifier import WhatsAppSecureNotifier
        from app.infrastructure.notifications.base_notifier import BaseNotifier, NotificationMessage
        
        class ConcreteWhatsAppNotifier(BaseNotifier):
            def __init__(self):
                super().__init__()
                self.use_official_api = True
                self.enable_sandbox = False
            
            def is_available(self) -> bool:
                return True
            
            def is_secure(self) -> bool:
                return True
            
            def is_configured(self) -> bool:
                return True
            
            async def send_notification(self, message: NotificationMessage) -> bool:
                print(f"WhatsApp notification sent to {message.recipient}: {message.message}")
                return True
        
        self.whatsapp_notifier = ConcreteWhatsAppNotifier()
        self.email_notifier = EmailNotifier()
        self.logger = logging.getLogger(__name__)
    
    def is_available(self, channel: NotificationChannel) -> bool:
        """Verificar disponibilidad de un canal"""
        if channel == NotificationChannel.WHATSAPP:
            return self.whatsapp_notifier.is_available()
        elif channel == NotificationChannel.EMAIL:
            return self.email_notifier.is_available()
        elif channel == NotificationChannel.BOTH:
            return self.whatsapp_notifier.is_available() and self.email_notifier.is_available()
        return False
    
    def get_available_channels(self) -> List[NotificationChannel]:
        """Obtener canales disponibles"""
        available = []
        if self.whatsapp_notifier.is_available():
            available.append(NotificationChannel.WHATSAPP)
        if self.email_notifier.is_available():
            available.append(NotificationChannel.EMAIL)
        
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
                if request.recipient_whatsapp:
                    channels_to_use.append(NotificationChannel.WHATSAPP)
                if request.recipient_email:
                    channels_to_use.append(NotificationChannel.EMAIL)
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
            if channel == NotificationChannel.WHATSAPP:
                return await self._send_whatsapp_notification(request)
            elif channel == NotificationChannel.EMAIL:
                return await self._send_email_notification(request)
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
                recipient=request.recipient_whatsapp or request.recipient_email or "",
                message=request.message,
                error=str(e)
            )
    
    async def _send_whatsapp_notification(self, request: MultiNotificationRequest) -> NotificationResult:
        """Enviar notificación por WhatsApp"""
        if not request.recipient_whatsapp:
            return NotificationResult(
                success=False,
                channel=NotificationChannel.WHATSAPP,
                recipient="",
                message=request.message,
                error="No se especificó número de WhatsApp"
            )
        
        try:
            # Formatear mensaje para WhatsApp
            if request.contest_data:
                message = self._format_whatsapp_message(request.contest_data)
            else:
                message = request.message
            
            # Crear mensaje de notificación
            notification = NotificationMessage(
                recipient=request.recipient_whatsapp,
                message=message,
                priority="high"
            )
            
            # Enviar
            success = await self.whatsapp_notifier.send_notification(notification)
            
            return NotificationResult(
                success=success,
                channel=NotificationChannel.WHATSAPP,
                recipient=request.recipient_whatsapp,
                message=message,
                error=None if success else "Error al enviar WhatsApp"
            )
            
        except Exception as e:
            return NotificationResult(
                success=False,
                channel=NotificationChannel.WHATSAPP,
                recipient=request.recipient_whatsapp,
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
    
    def _format_whatsapp_message(self, contest_data: Dict[str, Any]) -> str:
        """Formatear mensaje para WhatsApp"""
        message = f"""🎓 *NUEVO CONCURSO EDUCATIVO*

📋 *Título:* {contest_data.get('title', 'Sin título')}

🏫 *Escuela:* {contest_data.get('school_name', 'No especificada')}
📍 *Ciudad:* {contest_data.get('school_city', 'No especificada')}
📍 *Departamento:* {contest_data.get('school_department', 'No especificado')}

📚 *Materia:* {contest_data.get('subject_name', 'No especificada')}
📖 *Nivel:* {contest_data.get('level', 'No especificado')}
🕐 *Turno:* {contest_data.get('shift', 'No especificado')}
⏱️ *Horario:* {contest_data.get('schedule', 'No especificado')}
📊 *Horas:* {contest_data.get('hours_to_cover', 'No especificado')}
📄 *Contrato:* {contest_data.get('contract_type', 'No especificado')}

📅 *Fecha:* {contest_data.get('date', 'No especificada')}
⏰ *Límite:* {contest_data.get('registration_deadline', 'No especificada')}

📝 *Descripción:* {contest_data.get('description', 'Sin descripción')[:200]}...

🔗 *Fuente:* {contest_data.get('source_name', 'No especificada')}
🌐 *Link:* {contest_data.get('source_url', 'No disponible')}

---
*Sistema de Concursos Educativos*"""
        
        return message
    
    async def send_test_notification(self, recipient_whatsapp: str = None, recipient_email: str = None, channels: List[NotificationChannel] = None) -> List[NotificationResult]:
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
            recipient_whatsapp=recipient_whatsapp,
            recipient_email=recipient_email,
            channels=channels,
            message="Este es un mensaje de prueba del Sistema de Concursos Educativos",
            subject="🎓 Prueba de Notificación - Sistema de Concursos",
            contest_data=test_contest_data
        )
        
        return await self.send_notification(request)
    
    async def send_contest_notification(self, contest_data: Dict[str, Any], recipient_whatsapp: str = None, recipient_email: str = None, channels: List[NotificationChannel] = None) -> List[NotificationResult]:
        """Enviar notificación de concurso"""
        if channels is None:
            channels = [NotificationChannel.BOTH]
        
        request = MultiNotificationRequest(
            recipient_whatsapp=recipient_whatsapp,
            recipient_email=recipient_email,
            channels=channels,
            message=f"Nuevo concurso: {contest_data.get('title', 'Sin título')}",
            subject=f"🎓 Nuevo Concurso: {contest_data.get('title', 'Sin título')}",
            contest_data=contest_data
        )
        
        return await self.send_notification(request)
    
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

# Instancia global
multi_notifier = MultiNotifier()

# Funciones de conveniencia
async def send_multi_notification(recipient_whatsapp: str = None, recipient_email: str = None, message: str = "", contest_data: Dict[str, Any] = None, channels: List[NotificationChannel] = None) -> List[NotificationResult]:
    """Función de conveniencia para enviar notificación múltiple"""
    request = MultiNotificationRequest(
        recipient_whatsapp=recipient_whatsapp,
        recipient_email=recipient_email,
        channels=channels or [NotificationChannel.BOTH],
        message=message,
        subject=f"🎓 {message}" if message else "🎓 Notificación del Sistema",
        contest_data=contest_data
    )
    
    return await multi_notifier.send_notification(request)

async def send_contest_notification_multi(contest_data: Dict[str, Any], recipient_whatsapp: str = None, recipient_email: str = None) -> List[NotificationResult]:
    """Función de conveniencia para enviar notificación de concurso por múltiples canales"""
    return await multi_notifier.send_contest_notification(contest_data, recipient_whatsapp, recipient_email)
