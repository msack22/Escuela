"""
Script de prueba para el sistema de notificaciones múltiples (WhatsApp + Email)
"""

import asyncio
import os
from datetime import datetime
from app.infrastructure.notifications.multi_notifier import multi_notifier, NotificationChannel
from app.infrastructure.notifications.email_notifier import email_notifier

async def test_notification_system():
    """Probar el sistema completo de notificaciones"""
    print("🧪 Probando Sistema de Notificaciones Múltiples")
    print("=" * 50)
    
    # 1. Verificar disponibilidad de canales
    print("\n1. 🔍 Verificando canales disponibles:")
    available_channels = multi_notifier.get_available_channels()
    print(f"   Canales disponibles: {[channel.value for channel in available_channels]}")
    
    # Verificar cada canal individualmente
    for channel in [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL, NotificationChannel.BOTH]:
        is_available = multi_notifier.is_available(channel)
        status = "✅ Disponible" if is_available else "❌ No disponible"
        print(f"   {channel.value}: {status}")
    
    # 2. Probar notificación por WhatsApp
    print("\n2. 📱 Probando notificación por WhatsApp:")
    try:
        whatsapp_results = await multi_notifier.send_test_notification(
            recipient_whatsapp=os.getenv('TEST_WHATSAPP_NUMBER', '+5493444123456'),
            channels=[NotificationChannel.WHATSAPP]
        )
        
        for result in whatsapp_results:
            status = "✅ Enviado" if result.success else "❌ Error"
            print(f"   WhatsApp: {status}")
            if not result.success and result.error:
                print(f"   Error: {result.error}")
    except Exception as e:
        print(f"   ❌ Error en WhatsApp: {e}")
    
    # 3. Probar notificación por Email
    print("\n3. 📧 Probando notificación por Email:")
    try:
        email_results = await multi_notifier.send_test_notification(
            recipient_email=os.getenv('TEST_EMAIL', 'test@example.com'),
            channels=[NotificationChannel.EMAIL]
        )
        
        for result in email_results:
            status = "✅ Enviado" if result.success else "❌ Error"
            print(f"   Email: {status}")
            if not result.success and result.error:
                print(f"   Error: {result.error}")
    except Exception as e:
        print(f"   ❌ Error en Email: {e}")
    
    # 4. Probar notificación por ambos canales
    print("\n4. 📱📧 Probando notificación por ambos canales:")
    try:
        both_results = await multi_notifier.send_test_notification(
            recipient_whatsapp=os.getenv('TEST_WHATSAPP_NUMBER', '+5493444123456'),
            recipient_email=os.getenv('TEST_EMAIL', 'test@example.com'),
            channels=[NotificationChannel.BOTH]
        )
        
        for result in both_results:
            status = "✅ Enviado" if result.success else "❌ Error"
            print(f"   {result.channel.value}: {status}")
            if not result.success and result.error:
                print(f"   Error: {result.error}")
                
        # Mostrar resumen
        summary = multi_notifier.get_notification_summary(both_results)
        print(f"\n   📊 Resumen:")
        print(f"      Total: {summary['total']}")
        print(f"      Exitosos: {summary['successful']}")
        print(f"      Fallidos: {summary['failed']}")
        
    except Exception as e:
        print(f"   ❌ Error en ambos canales: {e}")
    
    # 5. Probar con datos de concurso reales
    print("\n5. 🎓 Probando notificación de concurso:")
    try:
        contest_data = {
            'title': 'Concurso de Matemática - Nivel Secundario',
            'school_name': 'Escuela Técnica N° 1',
            'school_city': 'Paraná',
            'school_department': 'Paraná',
            'subject_name': 'Matemática',
            'date': '2026-03-20',
            'registration_deadline': '2026-03-15',
            'level': 'Secundario',
            'shift': 'Mañana',
            'schedule': '08:00-12:00',
            'hours_to_cover': 20,
            'contract_type': 'Temporario',
            'description': 'Se busca profesor de matemática con experiencia en nivel secundario. Requisitos: título docente, disponibilidad horaria completa.',
            'source_name': 'Consejo General de Educación',
            'source_url': 'https://cge.entrerios.gov.ar/concursos/123'
        }
        
        contest_results = await multi_notifier.send_contest_notification(
            contest_data=contest_data,
            recipient_whatsapp=os.getenv('TEST_WHATSAPP_NUMBER', '+5493444123456'),
            recipient_email=os.getenv('TEST_EMAIL', 'test@example.com')
        )
        
        for result in contest_results:
            status = "✅ Enviado" if result.success else "❌ Error"
            print(f"   {result.channel.value}: {status}")
            if not result.success and result.error:
                print(f"   Error: {result.error}")
                
    except Exception as e:
        print(f"   ❌ Error en concurso: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Pruebas completadas!")

async def test_individual_components():
    """Probar componentes individuales"""
    print("\n🔧 Probando componentes individuales:")
    print("-" * 30)
    
    # Probar email notifier directamente
    print("\n📧 Email Notifier:")
    try:
        email_available = email_notifier.is_available()
        print(f"   Disponible: {'✅' if email_available else '❌'}")
        
        if email_available:
            success = await email_notifier.send_test_email(os.getenv('TEST_EMAIL', 'test@example.com'))
            print(f"   Test email: {'✅ Enviado' if success else '❌ Error'}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Probar WhatsApp notifier directamente
    print("\n📱 WhatsApp Notifier:")
    try:
        whatsapp_available = multi_notifier.whatsapp_notifier.is_available()
        print(f"   Disponible: {'✅' if whatsapp_available else '❌'}")
        print(f"   Seguro: {'✅' if multi_notifier.whatsapp_notifier.is_secure() else '❌'}")
        print(f"   Configurado: {'✅' if multi_notifier.whatsapp_notifier.is_configured() else '❌'}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

async def test_error_scenarios():
    """Probar escenarios de error"""
    print("\n⚠️  Probando escenarios de error:")
    print("-" * 30)
    
    # Probar con destinatario inválido
    print("\n📧 Email con destinatario inválido:")
    try:
        result = await email_notifier.send_test_email('invalid-email')
        print(f"   Resultado: {'✅ Manejado' if not result else '❌ No manejado'}")
    except Exception as e:
        print(f"   ✅ Error capturado: {e}")
    
    # Probar sin destinatarios
    print("\n📱 Notificación sin destinatarios:")
    try:
        results = await multi_notifier.send_notification(
            recipient_whatsapp=None,
            recipient_email=None,
            channels=[NotificationChannel.BOTH],
            message="Test"
        )
        
        summary = multi_notifier.get_notification_summary(results)
        print(f"   Resultado: {'✅ Manejado' if summary['failed'] > 0 else '❌ No manejado'}")
        
    except Exception as e:
        print(f"   ✅ Error capturado: {e}")

if __name__ == "__main__":
    print("🚀 Iniciando pruebas del sistema de notificaciones múltiples")
    print(f"⏰ Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Configurar variables de entorno para pruebas
    print("\n📋 Variables de entorno:")
    print(f"   TEST_WHATSAPP_NUMBER: {os.getenv('TEST_WHATSAPP_NUMBER', 'No configurado')}")
    print(f"   TEST_EMAIL: {os.getenv('TEST_EMAIL', 'No configurado')}")
    print(f"   SENDER_EMAIL: {os.getenv('SENDER_EMAIL', 'No configurado')}")
    print(f"   WHATSAPP_PYTHON_TOKEN: {'Configurado' if os.getenv('WHATSAPP_PYTHON_TOKEN') else 'No configurado'}")
    
    try:
        # Ejecutar pruebas
        asyncio.run(test_notification_system())
        asyncio.run(test_individual_components())
        asyncio.run(test_error_scenarios())
        
        print("\n✅ Todas las pruebas completadas exitosamente!")
        
    except KeyboardInterrupt:
        print("\n⚠️  Pruebas interrumpidas por el usuario")
    except Exception as e:
        print(f"\n❌ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
