#!/usr/bin/env python3
"""
Script de prueba para enviar email con SendGrid
"""

import os
import sys
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from decouple import config

def send_test_email():
    """Enviar email de prueba con SendGrid"""
    
    # Obtener configuración desde .env
    api_key = config('SENDGRID_API_KEY', default='')
    sender_email = config('SENDER_EMAIL', default='')
    
    if not api_key:
        print("❌ Error: SENDGRID_API_KEY no está configurada en el archivo .env")
        return False
    
    if not sender_email:
        print("❌ Error: SENDER_EMAIL no está configurado en el archivo .env")
        return False
    
    # Enviar email al mismo remitente para prueba
    recipient_email = sender_email
    
    try:
        # Crear mensaje
        message = Mail(
            from_email=sender_email,
            to_emails=recipient_email,
            subject='🧪 Email de Prueba - Sistema de Concursos',
            html_content=f'''
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f4; }}
                    .container {{ max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                    .header {{ background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ padding: 20px; }}
                    .success {{ background-color: #d4edda; color: #155724; padding: 15px; border-radius: 5px; border: 1px solid #c3e6cb; }}
                    .info {{ background-color: #e7f3ff; color: #0c5460; padding: 15px; border-radius: 5px; border: 1px solid #bee5eb; }}
                    .footer {{ margin-top: 30px; padding: 15px; background-color: #f8f9fa; text-align: center; border-radius: 0 0 10px 10px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎓 Sistema de Concursos Educativos</h1>
                        <h2>✅ Email de Prueba Exitoso</h2>
                    </div>
                    
                    <div class="content">
                        <div class="success">
                            <h3>🎉 ¡Funciona!</h3>
                            <p>La configuración de SendGrid está funcionando correctamente.</p>
                        </div>
                        
                        <div class="info">
                            <h3>📋 Detalles de la prueba:</h3>
                            <ul>
                                <li><strong>Remitente:</strong> {sender_email}</li>
                                <li><strong>Destinatario:</strong> {recipient_email}</li>
                                <li><strong>Servicio:</strong> SendGrid API</li>
                                <li><strong>Fecha:</strong> {os.popen("date").read().strip()}</li>
                            </ul>
                        </div>
                        
                        <h3>🚀 Próximos pasos:</h3>
                        <p>Tu sistema ya puede enviar notificaciones automáticas cuando se detecten nuevos concursos.</p>
                    </div>
                    
                    <div class="footer">
                        <p>Este email fue enviado automáticamente por el Sistema de Concursos Educativos</p>
                        <p>Configuración exitosa de SendGrid ✅</p>
                    </div>
                </div>
            </body>
            </html>
            '''
        )
        
        # Enviar email
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        
        # Verificar respuesta
        if response.status_code == 202:
            print(f"✅ Email enviado exitosamente a {recipient_email}")
            print(f"📧 Status Code: {response.status_code}")
            print(f"📋 Response Headers: {dict(response.headers)}")
            return True
        else:
            print(f"❌ Error al enviar email. Status Code: {response.status_code}")
            print(f"📋 Response Body: {response.body}")
            return False
            
    except Exception as e:
        print(f"❌ Error al enviar email: {str(e)}")
        return False

if __name__ == "__main__":
    print("🧪 Enviando email de prueba con SendGrid...")
    print("-" * 50)
    
    success = send_test_email()
    
    print("-" * 50)
    if success:
        print("🎉 ¡Prueba completada exitosamente!")
        print("📧 Revisa tu bandeja de entrada (y spam) para confirmar la recepción.")
    else:
        print("❌ La prueba falló. Revisa la configuración en el archivo .env")
    
    sys.exit(0 if success else 1)
