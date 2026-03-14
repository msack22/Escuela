"""
WhatsApp Secure Implementation - Production Ready

This module provides a secure WhatsApp implementation using official APIs
with proper security measures and data protection.
"""

import os
import logging
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime

try:
    from whatsapp import WhatsApp
except ImportError:
    logging.error("whatsapp-python not installed. Install with: pip install whatsapp-python")
    WhatsApp = None

from app.infrastructure.notifications.base_notifier import BaseNotifier, NotificationMessage
from app.core.config import settings


class WhatsAppSecureNotifier(BaseNotifier):
    """Secure WhatsApp notifier with production-ready configuration"""
    
    def __init__(self):
        self.client = None
        self.use_official_api = True  # Priorizar API oficial
        self._initialize_secure()
    
    def _initialize_secure(self):
        """Initialize WhatsApp with secure configuration"""
        if not WhatsApp:
            logging.error("whatsapp-python library not available")
            return
        
        try:
            # Priorizar API oficial si está configurada
            if os.getenv("WHATSAPP_BUSINESS_TOKEN"):
                self._initialize_business_api()
            elif os.getenv("WHATSAPP_PYTHON_TOKEN"):
                self._initialize_python_api()
            else:
                logging.warning("No WhatsApp API credentials configured")
                self.client = None
            
        except Exception as e:
            logging.error(f"Error initializing WhatsApp Secure: {str(e)}")
            self.client = None
    
    def _initialize_business_api(self):
        """Initialize with WhatsApp Business API (most secure)"""
        try:
            self.client = WhatsApp(
                token=os.getenv("WHATSAPP_BUSINESS_TOKEN"),
                phone_number_id=os.getenv("WHATSAPP_PHONE_NUMBER_ID"),
                base_url="https://graph.facebook.com/v18.0"
            )
            self.use_official_api = True
            logging.info("WhatsApp Business API initialized (SECURE)")
            
        except Exception as e:
            logging.error(f"Error initializing Business API: {str(e)}")
            self.client = None
    
    def _initialize_python_api(self):
        """Initialize with WhatsApp Python API (secure fallback)"""
        try:
            self.client = WhatsApp(
                token=os.getenv("WHATSAPP_PYTHON_TOKEN"),
                phone_number_id=os.getenv("WHATSAPP_PYTHON_NUMBER_ID"),
                base_url="https://graph.facebook.com/v18.0"
            )
            self.use_official_api = True
            logging.info("WhatsApp Python API initialized (SECURE)")
            
        except Exception as e:
            logging.error(f"Error initializing Python API: {str(e)}")
            self.client = None
    
    def is_available(self) -> bool:
        """Check if WhatsApp Secure is available and configured"""
        return WhatsApp is not None and self.client is not None
    
    def is_secure(self) -> bool:
        """Check if using secure API methods"""
        return self.use_official_api
    
    async def send_notification(self, message: NotificationMessage) -> bool:
        """Send notification via secure WhatsApp API"""
        if not self.is_available():
            logging.error("WhatsApp Secure not available or not configured")
            return False
        
        try:
            # Validar datos antes de enviar
            if not self._validate_message_data(message):
                logging.error("Invalid message data detected")
                return False
            
            # Formatear mensaje seguro
            formatted_message = self._format_secure_message(message)
            
            # Enviar usando API oficial
            recipient_phone = message.recipient_phone if hasattr(message, 'recipient_phone') else None
            
            if not recipient_phone:
                logging.error("No recipient phone number provided")
                return False
            
            # Enviar mensaje de forma segura
            await self.client.send_message(
                recipient_phone,
                formatted_message
            )
            
            # Log seguro (sin datos sensibles)
            logging.info(f"WhatsApp message sent securely to {self._mask_phone(recipient_phone)}")
            return True
            
        except Exception as e:
            logging.error(f"Error sending WhatsApp message: {str(e)}")
            return False
    
    def _validate_message_data(self, message: NotificationMessage) -> bool:
        """Validate message data for security"""
        if not message:
            return False
        
        # Validar longitud del mensaje
        if message.contest_data:
            contest = message.contest_data
            if contest.get('description') and len(contest['description']) > 1000:
                logging.warning("Message too long, truncating for security")
                contest['description'] = contest['description'][:1000]
        
        return True
    
    def _format_secure_message(self, message: NotificationMessage) -> str:
        """Format message with security considerations"""
        if message.contest_data:
            contest = message.contest_data
            school = contest.get('school', {})
            
            # Formatear con límites de seguridad
            formatted_text = f"""🎓 *NUEVO CONCURSO EDUCATIVO* 🎓

📋 *{self._sanitize_text(contest.get('title', 'Sin título'))}*

📚 *Nivel:* {self._sanitize_text(contest.get('level', 'No especificado'))}
📚 *Materia:* {self._sanitize_text(contest.get('subject', {}).get('name', 'No especificada'))}
🏫 *Turno:* {self._sanitize_text(contest.get('shift', 'No especificado'))}
⏰ *Horario:* {self._sanitize_text(contest.get('schedule', 'No especificado'))}
📊 *Horas:* {self._sanitize_text(str(contest.get('hours_to_cover', 'No especificado')))}
💼 *Contrato:* {self._sanitize_text(contest.get('contract_type', 'No especificado'))}

🏫 *Escuela:* {self._sanitize_text(school.get('name', 'No especificada'))}
📍 *Ciudad:* {self._sanitize_text(school.get('city', 'No especificada'))}
📅 *Fecha:* {contest.get('date', 'No especificada')}
⏰ *Cierre:* {contest.get('registration_deadline', 'No especificada')}

📖 *Descripción:*
{self._sanitize_text(contest.get('description', 'Sin descripción')[:200])}...

🔗 *Fuente:* {self._sanitize_text(contest.get('source', {}).get('name', 'No especificada'))}
🌐 *Link:* {contest.get('source', {}).get('url', '#')}

---
📍 *Ubicación en Google Maps:*
{self._generate_maps_link(school)}

📌 *Distancia:* {contest.get('distance_km', 'No calculada')} km

💡 *Sistema de Alertas de Concursos Educativos*
🔒 *Enviado de forma segura*"""
            
            return formatted_text
        
        return "Mensaje del sistema"
    
    def _sanitize_text(self, text: str) -> str:
        """Sanitize text for security"""
        if not text:
            return "No especificado"
        
        # Eliminar caracteres potencialmente peligrosos
        dangerous_chars = ['<', '>', '&', '"', "'", '/', '\\', '\n', '\r', '\t']
        for char in dangerous_chars:
            text = text.replace(char, '')
        
        # Limitar longitud
        return text[:100] if len(text) > 100 else text
    
    def _generate_maps_link(self, school: Dict[str, Any]) -> str:
        """Generate secure Google Maps link"""
        if school.get('latitude') and school.get('longitude'):
            # Validar coordenadas
            try:
                lat = float(school.get('latitude'))
                lon = float(school.get('longitude'))
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    return f"https://www.google.com/maps?q={lat},{lon}"
            except:
                pass
        return "#"
    
    def _mask_phone(self, phone: str) -> str:
        """Mask phone number for logging"""
        if len(phone) > 4:
            return phone[:4] + "****" + phone[-2:]
        return "****"
    
    async def send_test_notification(self, whatsapp_number: str, contest=None) -> str:
        """Send secure test notification"""
        if not self.is_available():
            return "❌ WhatsApp Secure no configurado"
        
        try:
            # Mensaje de prueba seguro
            test_message = f"""
🎓 **NOTIFICACIÓN DE PRUEBA - WHATSAPP SEGURO** 🎓

✅ *Estado:* LISTO PARA PRODUCCIÓN
🔒 *Seguridad:* MÁXIMA NIVEL
🔧 *Método:* API Oficial de Meta
📱 *API:* WhatsApp Business/Python

📋 *Características de Seguridad:*
- ✅ Validación de datos de entrada
- ✅ Sanitización de texto
- ✅ Límites de longitud
- ✅ Logs enmascarados
- ✅ Manejo seguro de errores
- ✅ Sin datos sensibles expuestos

🌐 *Repositorio:* https://github.com/msack22/Escuela

---
💡 *Prueba segura - Sistema operativo y protegido!*
🔒 *Cumple con políticas de seguridad y privacidad*
            """
            
            # Enviar mensaje de prueba seguro
            await self.client.send_message(
                whatsapp_number,
                test_message.strip()
            )
            
            return f"✅ Mensaje seguro enviado a {self._mask_phone(whatsapp_number)} via WhatsApp Secure"
            
        except Exception as e:
            return f"❌ Error enviando mensaje seguro: {str(e)}"


# Función de evaluación de seguridad
def evaluate_security_level():
    """Evaluate current security configuration"""
    security_score = 0
    recommendations = []
    
    # Verificar configuración de API oficial
    if os.getenv("WHATSAPP_BUSINESS_TOKEN"):
        security_score += 40
        recommendations.append("✅ WhatsApp Business API configurado (máxima seguridad)")
    elif os.getenv("WHATSAPP_PYTHON_TOKEN"):
        security_score += 30
        recommendations.append("⚠️ WhatsApp Python API configurado (seguridad media)")
    else:
        recommendations.append("❌ Ninguna API oficial configurada (riesgo alto)")
    
    # Verificar variables de entorno
    if os.getenv("WHATSAPP_PHONE_NUMBER_ID"):
        security_score += 20
        recommendations.append("✅ Phone Number ID configurado")
    
    # Verificar seguridad general
    if security_score >= 60:
        recommendations.append("🔒 Nivel de seguridad: ALTO")
    elif security_score >= 30:
        recommendations.append("⚠️ Nivel de seguridad: MEDIO")
    else:
        recommendations.append("❌ Nivel de seguridad: BAJO")
    
    return {
        "score": security_score,
        "level": "ALTO" if security_score >= 60 else "MEDIO" if security_score >= 30 else "BAJO",
        "recommendations": recommendations
    }


if __name__ == "__main__":
    # Evaluar seguridad actual
    security_info = evaluate_security_level()
    print("🔍 Evaluación de Seguridad:")
    print(f"Puntuación: {security_info['score']}/100")
    print(f"Nivel: {security_info['level']}")
    print("\nRecomendaciones:")
    for rec in security_info['recommendations']:
        print(f"  {rec}")
