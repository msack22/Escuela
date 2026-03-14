"""
WhatsApp Python Implementation - Pure Python WhatsApp Library

This module provides a clean, pure Python implementation using the whatsapp-python library
which is the official WhatsApp library for Python.
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


class WhatsAppPythonNotifier(BaseNotifier):
    """WhatsApp Python notifier using official whatsapp-python library"""
    
    def __init__(self):
        self.client = None
        self._initialize_whatsapp()
    
    def _initialize_whatsapp(self):
        """Initialize WhatsApp client"""
        if not WhatsApp:
            logging.error("whatsapp-python library not available")
            return
        
        try:
            # Inicializar el cliente de WhatsApp
            # Para desarrollo local, puedes usar web.whatsapp.com
            # Para producción, necesitas configurar la API de WhatsApp Business
            self.client = WhatsApp(
                token=os.getenv("WHATSAPP_PYTHON_TOKEN", ""),
                phone_number_id=os.getenv("WHATSAPP_PYTHON_NUMBER_ID", ""),
                base_url="https://graph.facebook.com/v18.0"
            )
            
            logging.info("WhatsApp Python client initialized successfully")
            
        except Exception as e:
            logging.error(f"Error initializing WhatsApp Python client: {str(e)}")
            self.client = None
    
    def is_available(self) -> bool:
        """Check if WhatsApp Python is available and configured"""
        return WhatsApp is not None and self.client is not None
    
    async def send_notification(self, message: NotificationMessage) -> bool:
        """Send notification via WhatsApp Python library"""
        if not self.is_available():
            logging.error("WhatsApp Python not available or not configured")
            return False
        
        try:
            # Formatear mensaje para WhatsApp
            formatted_message = self._format_message(message)
            
            # Enviar mensaje usando el cliente oficial
            # Para esto necesitas el número de teléfono del destinatario
            recipient_phone = message.recipient_phone if hasattr(message, 'recipient_phone') else None
            
            if not recipient_phone:
                logging.error("No recipient phone number provided")
                return False
            
            # Enviar mensaje de texto
            await self.client.send_message(
                recipient_phone,
                formatted_message
            )
            
            logging.info(f"WhatsApp message sent successfully to {recipient_phone}")
            return True
            
        except Exception as e:
            logging.error(f"Error sending WhatsApp message: {str(e)}")
            return False
    
    def _format_message(self, message: NotificationMessage) -> str:
        """Format message for WhatsApp"""
        if message.contest_data:
            contest = message.contest_data
            school = contest.get('school', {})
            
            # Formatear el mensaje con emojis y estructura clara
            formatted_text = f"""🎓 *NUEVO CONCURSO EDUCATIVO* 🎓

📋 *{contest.get('title', 'Sin título')}*

📚 *Nivel:* {contest.get('level', 'No especificado')}
📚 *Materia:* {contest.get('subject', {}).get('name', 'No especificada')}
🏫 *Turno:* {contest.get('shift', 'No especificado')}
⏰ *Horario:* {contest.get('schedule', 'No especificado')}
📊 *Horas:* {contest.get('hours_to_cover', 'No especificado')}
💼 *Contrato:* {contest.get('contract_type', 'No especificado')}

🏫 *Escuela:* {school.get('name', 'No especificada')}
📍 *Ciudad:* {school.get('city', 'No especificada')}
📅 *Fecha:* {self._format_date(contest.get('date'))}
⏰ *Cierre:* {self._format_date(contest.get('registration_deadline'))}

📖 *Descripción:*
{contest.get('description', 'Sin descripción')[:200]}...

🔗 *Fuente:* {contest.get('source', {}).get('name', 'No especificada')}
🌐 *Link:* {contest.get('source', {}).get('url', '#')}

---
📍 *Ubicación en Google Maps:*
{self._generate_maps_link(school)}

📌 *Distancia:* {contest.get('distance_km', 'No calculada')} km

💡 *Sistema de Alertas de Concursos Educativos*
📦 *Librería:* whatsapp-python (Python puro)"""
            
            return formatted_text
        
        return "Mensaje del sistema"
    
    def _generate_maps_link(self, school: Dict[str, Any]) -> str:
        """Generate Google Maps link for school location"""
        if school.get('latitude') and school.get('longitude'):
            return f"https://www.google.com/maps?q={school.get('latitude')},{school.get('longitude')}"
        return "#"
    
    def _format_date(self, date_str: Optional[str]) -> str:
        """Format date for display"""
        if not date_str:
            return "No especificada"
        try:
            date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return date_obj.strftime('%d/%m/%Y')
        except:
            return date_str
    
    async def send_test_notification(self, whatsapp_number: str, contest=None) -> str:
        """Send test notification via WhatsApp Python"""
        if not self.is_available():
            return "❌ WhatsApp Python no configurado"
        
        try:
            # Mensaje de prueba detallado
            test_message = f"""
🎓 **NOTIFICACIÓN DE PRUEBA - WHATSAPP-PYTHON** 🎓

✅ *Estado:* LISTO PARA PRODUCCIÓN
🔧 *Librería:* whatsapp-python (Python puro oficial)
📱 *API:* WhatsApp Graph API (Meta)
💰 *Costo:* GRATIS (hasta límites de uso)

📋 *Funcionalidades Activadas:*
- Scraping multi-fuente (Educación Gob, Entre Ríos, Facebook)
- Alertas automáticas personalizadas
- Gestión de calendarios con análisis de conflictos
- Geolocalización con Google Maps
- Base de datos MySQL con SQLAlchemy

🌐 *Repositorio:* https://github.com/msack22/Escuela

---
💡 *Prueba exitosa - Sistema operativo y funcional!*
📦 *Ventajas de whatsapp-python:*
- Python puro, sin dependencias externas
- API oficial de Meta
- Templates personalizados
- Soporte completo para multimedia
- Documentación extensa
- Comunidad activa
            """
            
            # Enviar mensaje de prueba
            await self.client.send_message(
                whatsapp_number,
                test_message.strip()
            )
            
            return f"✅ Mensaje de prueba enviado a {whatsapp_number} via WhatsApp Python"
            
        except Exception as e:
            return f"❌ Error enviando mensaje: {str(e)}"


class EnhancedWhatsAppNotifier(BaseNotifier):
    """Enhanced WhatsApp notifier with multiple library support"""
    
    def __init__(self):
        self.providers = []
        self._initialize_all_providers()
    
    def _initialize_all_providers(self):
        """Initialize all available WhatsApp providers in order of preference"""
        providers_config = [
            {
                "name": "whatsapp_python",
                "class": WhatsAppPythonNotifier,
                "priority": 1,  # Más alta prioridad - recomendado
                "description": "Python puro, API oficial de Meta"
            },
            {
                "name": "whatsapp_business",
                "class": WhatsAppBusinessNotifier,
                "priority": 2,
                "description": "API Business de Meta, 1000 msgs/mes gratis"
            },
            {
                "name": "twilio",
                "class": "TwilioNotifier",
                "priority": 3,
                "description": "Twilio - costo por mensaje, fallback"
            }
        ]
        
        for provider_config in providers_config:
            try:
                provider_class = provider_config["class"]
                provider = provider_class()
                
                if provider.is_available():
                    self.providers.append({
                        "name": provider_config["name"],
                        "instance": provider,
                        "priority": provider_config["priority"],
                        "description": provider_config["description"]
                    })
                    logging.info(f"✅ {provider_config['name']} provider initialized")
                    break  # Usar el primero disponible
            except Exception as e:
                logging.warning(f"❌ {provider_config['name']} provider failed: {str(e)}")
        
        if not self.providers:
            logging.error("No WhatsApp providers available")
    
    def is_available(self) -> bool:
        """Check if any WhatsApp provider is available"""
        return len(self.providers) > 0
    
    async def send_notification(self, message: NotificationMessage) -> bool:
        """Send notification using best available provider"""
        if not self.is_available():
            logging.error("No WhatsApp providers available")
            return False
        
        # Ordenar proveedores por prioridad (menor número = mayor prioridad)
        sorted_providers = sorted(self.providers, key=lambda x: x["priority"])
        
        for provider_info in sorted_providers:
            try:
                logging.info(f"🔄 Attempting to send via {provider_info['name']}")
                success = await provider_info["instance"].send_notification(message)
                if success:
                    logging.info(f"✅ Message sent via {provider_info['name']}")
                    return True
            except Exception as e:
                logging.warning(f"⚠️ {provider_info['name']} failed: {str(e)}")
                continue
        
        logging.error("❌ All WhatsApp providers failed")
        return False
    
    async def send_test_notification(self, whatsapp_number: str, contest=None) -> str:
        """Send test notification using best available provider"""
        if not self.is_available():
            return "❌ No hay proveedores WhatsApp configurados"
        
        # Usar el mejor proveedor disponible
        best_provider = min(self.providers, key=lambda x: x["priority"])
        
        if best_provider and hasattr(best_provider["instance"], 'send_test_notification'):
            try:
                result = await best_provider["instance"].send_test_notification(whatsapp_number, contest)
                return f"✅ Enviado via {best_provider['name']}: {result}"
            except Exception as e:
                return f"❌ Error con {best_provider['name']}: {str(e)}"
        
        return "❌ Todos los proveedores fallaron"
