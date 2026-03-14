#!/usr/bin/env python3
"""
Script de prueba para enviar email con Brevo (Sendinblue) - GRATIS PERMANENTE
"""

import os
import sys
import requests
from decouple import config

def send_test_email_brevo():
    """Enviar email de prueba con Brevo API"""
    
    # Obtener configuración desde .env
    api_key = config('BREVO_API_KEY', default='')
    sender_email = config('SENDER_EMAIL', default='')
    
    if not api_key:
        print("❌ Error: BREVO_API_KEY no está configurada en el archivo .env")
        return False
    
    if not sender_email:
        print("❌ Error: SENDER_EMAIL no está configurado en el archivo .env")
        return False
    
    # Configuración API Brevo
    url = "https://api.brevo.com/v3/smtp/email"
    
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": api_key
    }
    
    # Email al mismo remitente para prueba
    recipient_email = sender_email
    
    # Crear payload
    payload = {
        "sender": {
            "name": "Sistema de Concursos",
            "email": sender_email
        },
        "to": [
            {
                "email": recipient_email,
                "name": "Usuario Test"
            }
        ],
        "subject": "🧪 Email de Prueba - Sistema de Concursos (Brevo)",
        "htmlContent": f'''
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f4; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                .header {{ background-color: #0066ff; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
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
                    <h2>✅ Email de Prueba Exitoso (Brevo)</h2>
                </div>
                
                <div class="content">
                    <div class="success">
                        <h3>🎉 ¡Funciona con Brevo!</h3>
                        <p>La configuración de Brevo está funcionando correctamente.</p>
                        <p><strong>Plan:</strong> GRATIS 300 emails/día permanentes</p>
                    </div>
                    
                    <div class="info">
                        <h3>📋 Detalles de la prueba:</h3>
                        <ul>
                            <li><strong>Remitente:</strong> {sender_email}</li>
                            <li><strong>Destinatario:</strong> {recipient_email}</li>
                            <li><strong>Servicio:</strong> Brevo API</li>
                            <li><strong>Fecha:</strong> {os.popen("date").read().strip()}</li>
                        </ul>
                    </div>
                    
                    <h3>🚀 Ventajas de Brevo:</h3>
                    <ul>
                        <li>✅ 300 emails gratuitos por día (SIEMPRE)</li>
                        <li>✅ Sin límite de tiempo</li>
                        <li>✅ API moderna y fácil</li>
                        <li>✅ Plantillas de email</li>
                        <li>✅ Análisis de apertura</li>
                    </ul>
                </div>
                
                <div class="footer">
                    <p>Este email fue enviado automáticamente por el Sistema de Concursos Educativos</p>
                    <p>Configuración exitosa de Brevo ✅</p>
                </div>
            </div>
        </body>
        </html>
        '''
    }
    
    try:
        print(f"📧 Enviando email a {recipient_email}...")
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 201:
            print(f"✅ Email enviado exitosamente!")
            print(f"📧 Status Code: {response.status_code}")
            print(f"📋 Response: {response.json()}")
            return True
        else:
            print(f"❌ Error al enviar email. Status Code: {response.status_code}")
            print(f"📋 Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error al enviar email: {str(e)}")
        return False

if __name__ == "__main__":
    print("🧪 Enviando email de prueba con Brevo...")
    print("-" * 50)
    
    success = send_test_email_brevo()
    
    print("-" * 50)
    if success:
        print("🎉 ¡Prueba completada exitosamente!")
        print("📧 Revisa tu bandeja de entrada (y spam) para confirmar la recepción.")
    else:
        print("❌ La prueba falló. Revisa la configuración en el archivo .env")
    
    sys.exit(0 if success else 1)
