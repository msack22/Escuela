from twilio.rest import Client
from typing import Optional
import logging

from app.infrastructure.notifications.base_notifier import BaseNotifier, NotificationMessage
from app.core.config import settings

logger = logging.getLogger(__name__)


class WhatsAppNotifier(BaseNotifier):
    """WhatsApp notification service using Twilio API"""
    
    def __init__(self):
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Twilio client if credentials are available"""
        if all([
            settings.twilio_account_sid,
            settings.twilio_auth_token,
            settings.twilio_whatsapp_number
        ]):
            try:
                self.client = Client(
                    settings.twilio_account_sid,
                    settings.twilio_auth_token
                )
                logger.info("Twilio WhatsApp client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Twilio client: {e}")
        else:
            logger.warning("Twilio credentials not configured")
    
    async def send_notification(self, message: NotificationMessage) -> bool:
        """Send WhatsApp notification"""
        if not self.is_configured():
            logger.error("WhatsApp notifier not configured")
            return False
        
        try:
            # Format phone number (ensure it starts with +)
            recipient = message.recipient
            if not recipient.startswith('+'):
                recipient = '+' + recipient
            
            # Create formatted message
            formatted_message = self._format_message(message)
            
            # Send WhatsApp message
            twilio_message = self.client.messages.create(
                body=formatted_message,
                from_=f"whatsapp:{settings.twilio_whatsapp_number}",
                to=f"whatsapp:{recipient}"
            )
            
            logger.info(f"WhatsApp message sent: {twilio_message.sid}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send WhatsApp message: {e}")
            return False
    
    def _format_message(self, message: NotificationMessage) -> str:
        """Format the message for WhatsApp"""
        if message.contest_data:
            contest = message.contest_data
            school = contest.get('school', {})
            
            formatted_msg = f"""
🎓 *NUEVO CONCURSO EDUCATIVO* 🎓

📋 *{contest.get('title', 'Sin título')}*

📚 *Nivel:* {contest.get('level', 'No especificado')}
📚 *Materia:* {contest.get('subject', {}).get('name', 'No especificada')}
🏫 *Turno:* {contest.get('shift', 'No especificado')}
⏰ *Horario:* {contest.get('schedule', 'No especificado')}
📊 *Horas a cubrir:* {contest.get('hours_to_cover', 'No especificado')}
💼 *Tipo de contrato:* {contest.get('contract_type', 'No especificado')}
🏫 *Escuela:* {school.get('name', 'No especificada')}
📍 *Ciudad:* {school.get('city', 'No especificada')}
📅 *Fecha:* {self._format_date(contest.get('date'))}
⏰ *Fecha límite inscripción:* {self._format_date(contest.get('registration_deadline'))}

📖 *Descripción:*
{contest.get('description', 'Sin descripción')[:200]}...

🔗 *Fuente:* {contest.get('source', {}).get('name', 'No especificada')}
🌐 *Link:* {contest.get('source', {}).get('url', '#')}

---
📍 *Ubicación en Google Maps:*
{self._generate_maps_link(school)}

📌 *Distancia aproximada:* {contest.get('distance_km', 'No calculada')} km

💡 *Sistema de Alertas de Concursos Educativos*
"""
        else:
            formatted_msg = f"""
{message.subject}

{message.message}
"""
        
        return formatted_msg.strip()
    
    def _format_date(self, date_str: Optional[str]) -> str:
        """Format date string for display"""
        if not date_str:
            return "No especificada"
        
        try:
            from datetime import datetime
            date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return date_obj.strftime("%d/%m/%Y %H:%M")
        except:
            return date_str
    
    def _generate_maps_link(self, school: dict) -> str:
        """Generate Google Maps link for school location"""
        if school.get('latitude') and school.get('longitude'):
            return f"https://maps.google.com/?q={school['latitude']},{school['longitude']}"
        
        # Fallback to address-based search
        address_parts = [
            school.get('address', ''),
            school.get('city', ''),
            school.get('department', ''),
            'Argentina'
        ]
        address = ', '.join(filter(None, address_parts))
        
        if address:
            return f"https://maps.google.com/?q={address.replace(' ', '+')}"
        
        return "No disponible"
    
    def is_configured(self) -> bool:
        """Check if WhatsApp notifier is properly configured"""
        return (
            self.client is not None and
            all([
                settings.twilio_account_sid,
                settings.twilio_auth_token,
                settings.twilio_whatsapp_number
            ])
        )
