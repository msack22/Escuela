"""
Configuración y utilidades para envío de emails
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional, Dict, Any
import logging
from datetime import datetime
from dataclasses import dataclass
import os
from decouple import config

@dataclass
class EmailConfig:
    """Configuración para envío de emails"""
    smtp_server: str
    smtp_port: int
    sender_email: str
    sender_password: str
    use_tls: bool = True
    
    @classmethod
    def from_env(cls) -> 'EmailConfig':
        """Crear configuración desde variables de entorno"""
        return cls(
            smtp_server=config('SMTP_SERVER', default='smtp.gmail.com'),
            smtp_port=config('SMTP_PORT', default=587, cast=int),
            sender_email=config('SENDER_EMAIL', default=''),
            sender_password=config('SENDER_PASSWORD', default=''),
            use_tls=config('SMTP_USE_TLS', default=True, cast=bool)
        )

@dataclass
class EmailMessage:
    """Estructura de mensaje de email"""
    to: str
    subject: str
    body: str
    is_html: bool = False
    attachments: Optional[List[str]] = None
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None

class EmailNotifier:
    """Servicio de notificaciones por email"""
    
    def __init__(self, config: Optional[EmailConfig] = None):
        self.config = config or EmailConfig.from_env()
        self.logger = logging.getLogger(__name__)
        self._is_configured = bool(self.config.sender_email and self.config.sender_password)
    
    def is_configured(self) -> bool:
        """Verificar si el servicio está configurado"""
        return self._is_configured
    
    def is_available(self) -> bool:
        """Verificar si el servicio está disponible"""
        return self._is_configured and self._test_connection()
    
    def _test_connection(self) -> bool:
        """Probar conexión con el servidor SMTP"""
        try:
            context = ssl.create_default_context()
            with smtplib.SMTP(self.config.smtp_server, self.config.smtp_port) as server:
                if self.config.use_tls:
                    server.starttls(context=context)
                server.login(self.config.sender_email, self.config.sender_password)
            return True
        except Exception as e:
            self.logger.error(f"Error testing SMTP connection: {e}")
            return False
    
    async def send_email(self, message: EmailMessage) -> bool:
        """Enviar email"""
        if not self._is_configured:
            self.logger.error("Email service not configured")
            return False
        
        try:
            # Crear mensaje
            msg = MIMEMultipart('alternative')
            msg['Subject'] = self._sanitize_subject(message.subject)
            msg['From'] = self.config.sender_email
            msg['To'] = message.to
            
            if message.cc:
                msg['Cc'] = ', '.join(message.cc)
            if message.bcc:
                msg['Bcc'] = ', '.join(message.bcc)
            
            # Agregar cuerpo del mensaje
            if message.is_html:
                html_part = MIMEText(message.body, 'html')
                msg.attach(html_part)
            else:
                text_part = MIMEText(message.body, 'plain')
                msg.attach(text_part)
            
            # Agregar adjuntos si existen
            if message.attachments:
                for file_path in message.attachments:
                    if os.path.exists(file_path):
                        self._attach_file(msg, file_path)
            
            # Enviar email
            context = ssl.create_default_context()
            with smtplib.SMTP(self.config.smtp_server, self.config.smtp_port) as server:
                if self.config.use_tls:
                    server.starttls(context=context)
                server.login(self.config.sender_email, self.config.sender_password)
                
                # Combinar todos los destinatarios
                all_recipients = [message.to]
                if message.cc:
                    all_recipients.extend(message.cc)
                if message.bcc:
                    all_recipients.extend(message.bcc)
                
                server.sendmail(self.config.sender_email, all_recipients, msg.as_string())
            
            self.logger.info(f"Email sent successfully to {message.to}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error sending email: {e}")
            return False
    
    def _attach_file(self, msg: MIMEMultipart, file_path: str):
        """Adjuntar archivo al email"""
        try:
            with open(file_path, "rb") as attachment:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(attachment.read())
            
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename= {os.path.basename(file_path)}"
            )
            msg.attach(part)
        except Exception as e:
            self.logger.error(f"Error attaching file {file_path}: {e}")
    
    def _sanitize_subject(self, subject: str) -> str:
        """Sanitizar asunto del email"""
        if not subject:
            return "Sin Asunto"
        
        # Limitar longitud y remover caracteres peligrosos
        dangerous_chars = ['\n', '\r', '\t']
        for char in dangerous_chars:
            subject = subject.replace(char, '')
        
        return subject[:100] if len(subject) > 100 else subject
    
    def _format_contest_email(self, contest_data: Dict[str, Any]) -> EmailMessage:
        """Formatear email de concurso"""
        subject = f"🎓 Nuevo Concurso: {contest_data.get('title', 'Sin título')}"
        
        # Crear cuerpo HTML
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background-color: #2196F3; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; background-color: #f9f9f9; }}
                .contest-info {{ margin: 15px 0; }}
                .field {{ margin: 10px 0; }}
                .label {{ font-weight: bold; color: #333; }}
                .value {{ color: #666; }}
                .footer {{ margin-top: 30px; padding: 15px; background-color: #eee; text-align: center; }}
                .btn {{ background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🎓 Sistema de Concursos Educativos</h1>
                <h2>Nuevo Concurso Disponible</h2>
            </div>
            
            <div class="content">
                <div class="contest-info">
                    <h3>{contest_data.get('title', 'Sin título')}</h3>
                    
                    <div class="field">
                        <span class="label">📍 Escuela:</span>
                        <span class="value">{contest_data.get('school_name', 'No especificada')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">📍 Ciudad:</span>
                        <span class="value">{contest_data.get('school_city', 'No especificada')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">📍 Departamento:</span>
                        <span class="value">{contest_data.get('school_department', 'No especificado')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">📚 Materia:</span>
                        <span class="value">{contest_data.get('subject_name', 'No especificada')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">📅 Fecha:</span>
                        <span class="value">{contest_data.get('date', 'No especificada')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">⏰ Fecha límite:</span>
                        <span class="value">{contest_data.get('registration_deadline', 'No especificada')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">📖 Nivel:</span>
                        <span class="value">{contest_data.get('level', 'No especificado')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">🕐 Turno:</span>
                        <span class="value">{contest_data.get('shift', 'No especificado')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">⏱️ Horario:</span>
                        <span class="value">{contest_data.get('schedule', 'No especificado')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">📊 Horas:</span>
                        <span class="value">{contest_data.get('hours_to_cover', 'No especificado')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">📄 Contrato:</span>
                        <span class="value">{contest_data.get('contract_type', 'No especificado')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">📝 Descripción:</span>
                        <span class="value">{contest_data.get('description', 'Sin descripción')}</span>
                    </div>
                    
                    <div class="field">
                        <span class="label">🔗 Fuente:</span>
                        <span class="value">{contest_data.get('source_name', 'No especificada')}</span>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 20px 0;">
                    <a href="{contest_data.get('source_url', '#')}" class="btn">Ver Detalles</a>
                </div>
            </div>
            
            <div class="footer">
                <p>Este email fue enviado automáticamente por el Sistema de Concursos Educativos</p>
                <p>Si no deseas recibir más notificaciones, contacta al administrador.</p>
            </div>
        </body>
        </html>
        """
        
        return EmailMessage(
            to=contest_data.get('recipient_email', ''),
            subject=subject,
            body=html_body,
            is_html=True
        )
    
    async def send_contest_notification(self, contest_data: Dict[str, Any]) -> bool:
        """Enviar notificación de concurso por email"""
        try:
            email_message = self._format_contest_email(contest_data)
            return await self.send_email(email_message)
        except Exception as e:
            self.logger.error(f"Error sending contest notification: {e}")
            return False
    
    async def send_test_email(self, recipient_email: str) -> bool:
        """Enviar email de prueba"""
        test_data = {
            'title': 'Concurso de Prueba',
            'school_name': 'Escuela Test',
            'school_city': 'Paraná',
            'school_department': 'Paraná',
            'subject_name': 'Matemática',
            'date': datetime.now().strftime('%Y-%m-%d'),
            'registration_deadline': datetime.now().strftime('%Y-%m-%d'),
            'level': 'Secundario',
            'shift': 'Mañana',
            'schedule': '08:00-12:00',
            'hours_to_cover': 20,
            'contract_type': 'Temporario',
            'description': 'Este es un concurso de prueba para verificar el funcionamiento del sistema de notificaciones por email.',
            'source_name': 'Test Source',
            'source_url': 'https://example.com',
            'recipient_email': recipient_email
        }
        
        return await self.send_contest_notification(test_data)

# Instancia global
email_notifier = EmailNotifier()

# Función de conveniencia
async def send_email_notification(recipient_email: str, contest_data: Dict[str, Any]) -> bool:
    """Función de conveniencia para enviar notificación por email"""
    contest_data['recipient_email'] = recipient_email
    return await email_notifier.send_contest_notification(contest_data)
