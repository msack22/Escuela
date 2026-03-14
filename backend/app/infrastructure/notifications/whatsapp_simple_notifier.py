"""
WhatsApp Simple Implementation - No Token Required

This module provides a simple WhatsApp implementation using whatsapp-python
that works without complex token setup for testing purposes.
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


class WhatsAppSimpleNotifier(BaseNotifier):
    """Simple WhatsApp notifier for testing without complex setup"""
    
    def __init__(self):
        self.client = None
        self._initialize_simple()
    
    def _initialize_simple(self):
        """Initialize WhatsApp with simple configuration"""
        if not WhatsApp:
            logging.error("whatsapp-python library not available")
            return
        
        try:
            # Configuración simple para desarrollo
            # Esto usa WhatsApp Web en tu navegador
            self.client = WhatsApp(
                phone_number="+5490000000000",  # Tu número
                browser="chrome",  # Usa Chrome
                headless=False  # Abre navegador visible
            )
            
            logging.info("WhatsApp Simple client initialized")
            
        except Exception as e:
            logging.error(f"Error initializing WhatsApp Simple: {str(e)}")
            self.client = None
    
    def is_available(self) -> bool:
        """Check if WhatsApp Simple is available"""
        return WhatsApp is not None and self.client is not None
    
    async def send_notification(self, message: NotificationMessage) -> bool:
        """Send notification via WhatsApp Simple"""
        if not self.is_available():
            logging.error("WhatsApp Simple not available")
            return False
        
        try:
            # Formatear mensaje
            formatted_message = self._format_message(message)
            
            # Enviar mensaje (método simple)
            await self.client.send_message(
                "+5490000000000",  # Tu número
                formatted_message
            )
            
            logging.info("WhatsApp Simple message sent successfully")
            return True
            
        except Exception as e:
            logging.error(f"Error sending WhatsApp Simple message: {str(e)}")
            return False
    
    def _format_message(self, message: NotificationMessage) -> str:
        """Format message for WhatsApp Simple"""
        if message.contest_data:
            contest = message.contest_data
            school = contest.get('school', {})
            
            formatted_text = f"""🎓 NUEVO CONCURSO EDUCATIVO 🎓

📋 {contest.get('title', 'Sin título')}

📚 Nivel: {contest.get('level', 'No especificado')}
📚 Materia: {contest.get('subject', {}).get('name', 'No especificada')}
🏫 Turno: {contest.get('shift', 'No especificado')}
⏰ Horario: {contest.get('schedule', 'No especificado')}
📊 Horas: {contest.get('hours_to_cover', 'No especificado')}
💼 Contrato: {contest.get('contract_type', 'No especificado')}

🏫 Escuela: {school.get('name', 'No especificada')}
📍 Ciudad: {school.get('city', 'No especificada')}
📅 Fecha: {contest.get('date', 'No especificada')}
⏰ Cierre: {contest.get('registration_deadline', 'No especificada')}

📖 Descripción:
{contest.get('description', 'Sin descripción')[:200]}...

🔗 Fuente: {contest.get('source', {}).get('name', 'No especificada')}
🌐 Link: {contest.get('source', {}).get('url', '#')}

---
📍 Ubicación en Google Maps:
{self._generate_maps_link(school)}

📌 Distancia: {contest.get('distance_km', 'No calculada')} km

💡 Sistema de Alertas de Concursos Educativos"""
            
            return formatted_text
        
        return "Mensaje del sistema"
    
    def _generate_maps_link(self, school: Dict[str, Any]) -> str:
        """Generate Google Maps link for school location"""
        if school.get('latitude') and school.get('longitude'):
            return f"https://www.google.com/maps?q={school.get('latitude')},{school.get('longitude')}"
        return "#"
    
    async def send_test_notification(self, whatsapp_number: str, contest=None) -> str:
        """Send test notification via WhatsApp Simple"""
        if not self.is_available():
            return "❌ WhatsApp Simple no configurado"
        
        try:
            # Mensaje de prueba simple
            test_message = f"""🎓 NOTIFICACIÓN DE PRUEBA - WHATSAPP SIMPLE

✅ Estado: LISTO PARA PRODUCCIÓN
🔧 Método: WhatsApp Simple (sin token complejo)
📱 Configuración: Automática con WhatsApp Web

📋 Funcionalidades Activadas:
- Scraping multi-fuente
- Alertas automáticas
- Gestión de calendarios
- Geolocalización con mapas

🌐 Repositorio: https://github.com/msack22/Escuela

---
💡 Prueba exitosa - Sistema operativo y funcional!
📦 Ventajas: Sin configuración compleja, Python puro"""
            
            # Enviar mensaje de prueba
            await self.client.send_message(
                whatsapp_number,
                test_message.strip()
            )
            
            return f"✅ Mensaje de prueba enviado a {whatsapp_number} via WhatsApp Simple"
            
        except Exception as e:
            return f"❌ Error enviando mensaje: {str(e)}"


# Función de prueba simple
async def test_whatsapp_simple():
    """Simple test function for WhatsApp"""
    try:
        notifier = WhatsAppSimpleNotifier()
        
        if notifier.is_available():
            result = await notifier.send_test_notification("+5490000000000")
            print(result)
        else:
            print("❌ WhatsApp Simple no disponible")
            
    except Exception as e:
        print(f"❌ Error en prueba: {e}")


if __name__ == "__main__":
    # Ejecutar prueba directa
    asyncio.run(test_whatsapp_simple())
