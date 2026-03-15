#!/usr/bin/env python3
"""
Script de prueba para el scraper especializado de Islas del Ibicuy
"""

import asyncio
import sys
import os

# Agregar el directorio backend al path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.infrastructure.scrapers.islas_ibicuy_scraper import IslasIbicuyScraper
from app.infrastructure.scrapers.facebook_scraper import FacebookScraper
from app.infrastructure.scrapers.enterios_scraper import EntreriosScraper


async def test_islas_ibicuy_scraper():
    """Probar el scraper especializado de Islas del Ibicuy"""
    print("🏝️ Iniciando prueba del scraper de Islas del Ibicuy...")
    
    scraper = IslasIbicuyScraper()
    
    # Verificar disponibilidad
    print("📊 Verificando disponibilidad de fuentes...")
    available = await scraper.is_available()
    print(f"✅ Disponibilidad: {available}")
    
    # Extraer concursos (limitado a 10 para prueba)
    print("🔍 Extrayendo concursos...")
    contests = await scraper.scrape_contests(limit=10)
    
    print(f"\n🎉 Se encontraron {len(contests)} concursos:")
    print("=" * 80)
    
    for i, contest in enumerate(contests, 1):
        print(f"\n📋 Concurso #{i}")
        print(f"🏫 Título: {contest.title}")
        print(f"📖 Descripción: {contest.description[:100]}...")
        print(f"🏫 Escuela: {contest.school_name}")
        print(f"🏙️ Ciudad: {contest.school_city}")
        print(f"📍 Departamento: {contest.school_department}")
        print(f"📚 Materia: {contest.subject_name}")
        print(f"🎓 Nivel: {contest.level}")
        print(f"🔗 URL: {contest.source_url}")
        print(f"📅 Fecha: {contest.date}")
        if contest.registration_deadline:
            print(f"⏰ Cierre: {contest.registration_deadline}")
        print("-" * 40)
    
    return contests


async def test_facebook_scraper():
    """Probar el scraper de Facebook específicamente"""
    print("\n📘 Iniciando prueba del scraper de Facebook...")
    
    scraper = FacebookScraper()
    
    # Verificar disponibilidad
    available = await scraper.is_available()
    print(f"✅ Disponibilidad Facebook: {available}")
    
    # Extraer concursos (limitado)
    print("🔍 Extrayendo concursos de Facebook...")
    contests = await scraper.scrape_contests(limit=5)
    
    print(f"\n🎉 Se encontraron {len(contests)} concursos en Facebook:")
    print("=" * 80)
    
    for i, contest in enumerate(contests, 1):
        print(f"\n📋 Facebook Concurso #{i}")
        print(f"🏫 Título: {contest.title}")
        print(f"📖 Descripción: {contest.description[:100]}...")
        print(f"🔗 URL: {contest.source_url}")
        print("-" * 40)
    
    return contests


async def test_specific_urls():
    """Probar las URLs específicas que proporcionó el usuario"""
    print("\n🌐 Probando URLs específicas del usuario...")
    
    specific_urls = [
        "https://cge.entrerios.gov.ar/2026/03/convocatoria-horas-formacion-etica-y-ciudadana-escuela-secundaria-n-3-francisco-ramirez/",
        "https://cge.entrerios.gov.ar/2026/03/convocatoria-escuela-secundaria-n-3-francisco-ramirez/",
        "https://cge.entrerios.gov.ar/departamental-islas-del-ibicuy/#concursos-nivel-secundario",
        "https://www.facebook.com/ddeislasdelibicuy"
    ]
    
    scraper = EntreriosScraper()
    
    for url in specific_urls:
        print(f"\n🔍 Analizando URL: {url}")
        try:
            # Para URLs de CGE
            if 'cge.entrerios.gov.ar' in url:
                contests = await scraper.scrape_contests(limit=20)
                # Filtrar concursos relacionados con la URL
                related = [c for c in contests if any(keyword in c.title.lower() for keyword in ['ibicuy', 'francisco ramirez', 'paranacito'])]
                print(f"✅ Se encontraron {len(related)} concursos relacionados")
                for contest in related[:2]:  # Mostrar solo los primeros 2
                    print(f"   📋 {contest.title}")
            
            # Para Facebook
            elif 'facebook.com' in url:
                fb_scraper = FacebookScraper()
                contests = await fb_scraper.scrape_contests(limit=10)
                print(f"✅ Se encontraron {len(contests)} concursos en Facebook")
                for contest in contests[:2]:  # Mostrar solo los primeros 2
                    print(f"   📋 {contest.title}")
        
        except Exception as e:
            print(f"❌ Error procesando {url}: {e}")


async def main():
    """Función principal de prueba"""
    print("🚀 Iniciando pruebas de scrapers para Islas del Ibicuy")
    print("=" * 80)
    
    try:
        # 1. Probar scraper especializado
        islas_contests = await test_islas_ibicuy_scraper()
        
        # 2. Probar scraper de Facebook
        facebook_contests = await test_facebook_scraper()
        
        # 3. Probar URLs específicas
        await test_specific_urls()
        
        print("\n" + "=" * 80)
        print("🎉 Pruebas completadas!")
        print(f"📊 Resumen:")
        print(f"   🏝️ Scraper Islas del Ibicuy: {len(islas_contests)} concursos")
        print(f"   📘 Scraper Facebook: {len(facebook_contests)} concursos")
        print(f"   🌐 Total: {len(islas_contests) + len(facebook_contests)} concursos encontrados")
        
    except Exception as e:
        print(f"❌ Error en las pruebas: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
