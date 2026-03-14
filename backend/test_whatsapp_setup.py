#!/usr/bin/env python3
"""
Script de prueba para WhatsApp Business API
Ejecuta este script para verificar que tu configuración funciona correctamente
"""

import os
import sys
import asyncio
from pathlib import Path

# Agregar el path del proyecto
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from app.infrastructure.notifications.whatsapp_secure_notifier import WhatsAppSecureNotifier, evaluate_security_level
except ImportError as e:
    print(f"❌ Error importando módulos: {e}")
    sys.exit(1)


async def test_whatsapp_business():
    """Probar la configuración de WhatsApp Business API"""
    print("🔍 Probando configuración de WhatsApp Business API...")
    
    # Evaluar seguridad actual
    print("\n📊 Evaluación de Seguridad:")
    security_info = evaluate_security_level()
    print(f"   Puntuación: {security_info['score']}/100")
    print(f"   Nivel: {security_info['level']}")
    print("\n   Recomendaciones:")
    for rec in security_info['recommendations']:
        print(f"     {rec}")
    
    # Verificar configuración
    print("\n🔧 Verificación de Configuración:")
    
    token = os.getenv("WHATSAPP_BUSINESS_TOKEN")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    
    if token:
        print("   ✅ WHATSAPP_BUSINESS_TOKEN: Configurado")
        if token.startswith("EAA"):
            print("   ✅ Formato del token: Correcto")
        else:
            print("   ⚠️ Formato del token: Revisar (debe empezar con 'EAA')")
    else:
        print("   ❌ WHATSAPP_BUSINESS_TOKEN: No configurado")
    
    if phone_id:
        print("   ✅ WHATSAPP_PHONE_NUMBER_ID: Configurado")
        if phone_id.isdigit():
            print("   ✅ Formato del Phone ID: Correcto")
        else:
            print("   ⚠️ Formato del Phone ID: Revisar (deben ser solo números)")
    else:
        print("   ❌ WHATSAPP_PHONE_NUMBER_ID: No configurado")
    
    # Probar el notificador
    print("\n📱 Probando Notificador:")
    try:
        notifier = WhatsAppSecureNotifier()
        
        if notifier.is_available():
            print("   ✅ Notificador: Disponible")
            print(f"   ✅ Modo seguro: {'Sí' if notifier.is_secure() else 'No'}")
            
            # Enviar mensaje de prueba
            print("\n📤 Enviando mensaje de prueba...")
            result = await notifier.send_test_notification("+5490000000000")
            print(f"   Resultado: {result}")
            
        else:
            print("   ❌ Notificador: No disponible")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n" + "="*50)
    print("🎯 RESUMEN:")
    
    if security_info['score'] >= 60:
        print("   ✅ Configuración SEGURA - Lista para producción")
    elif security_info['score'] >= 30:
        print("   ⚠️ Configuración MEDIA - Mejorar seguridad recomendada")
    else:
        print("   ❌ Configuración INSEGURA - Corregir problemas")
    
    print("\n📞 Para ayuda adicional:")
    print("   📋 Documentación: https://developers.facebook.com/docs/whatsapp/business-platform")
    print("   🌐 Repositorio: https://github.com/msack22/Escuela")


if __name__ == "__main__":
    print("🚀 Iniciando prueba de WhatsApp Business API...")
    asyncio.run(test_whatsapp_business())
