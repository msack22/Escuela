#!/usr/bin/env python3
"""
Script para probar todos los scrapers y ver resultados
"""
import asyncio
import sys
import os

# Agregar el directorio del backend al path
sys.path.append('/Users/matiassack/Documents/Matias/Escuela/backend')

from app.infrastructure.scrapers.scraper_factory import ScrapingService


async def test_all_scrapers():
    """Probar todos los scrapers y mostrar resultados"""
    print("🚀 Iniciando prueba completa de todos los scrapers...")
    print("=" * 60)
    
    # Inicializar servicio de scraping
    scraping_service = ScrapingService()
    
    # Obtener todos los scrapers disponibles
    scrapers_dict = scraping_service.factory.get_available_scrapers()
    
    total_contests = 0
    results = {}
    
    for scraper_name, scraper in scrapers_dict.items():
        if not scraper:
            continue
            
        print(f"\n🔍 Probando scraper: {scraper_name}")
        print("-" * 40)
        
        try:
            # Ejecutar scraping
            contests = await scraper.scrape_contests(limit=50)  # Limitar a 50 por scraper
            contest_count = len(contests)
            
            results[scraper_name] = {
                'contests_found': contest_count,
                'contests': contests[:5]  # Mostrar solo primeros 5
            }
            
            total_contests += contest_count
            print(f"✅ {scraper_name}: {contest_count} concursos encontrados")
            
            # Mostrar primeros 5 concursos
            for i, contest in enumerate(contests[:5]):
                print(f"   {i+1}. {contest.title}")
                print(f"      Escuela: {contest.school_name}")
                print(f"      URL: {contest.source_url}")
            
        except Exception as e:
            print(f"❌ Error en {scraper_name}: {e}")
            results[scraper_name] = {
                'contests_found': 0,
                'error': str(e)
            }
    
    # Resumen final
    print("\n" + "=" * 60)
    print("📊 RESUMEN COMPLETO DE SCRAPING")
    print("=" * 60)
    
    for scraper_name, result in results.items():
        if 'error' in result:
            print(f"❌ {scraper_name}: ERROR - {result['error']}")
        else:
            print(f"✅ {scraper_name}: {result['contests_found']} concursos")
    
    print(f"\n🎯 TOTAL DE CONCURSOS ENCONTRADOS: {total_contests}")
    print("=" * 60)
    
    return results, total_contests


if __name__ == "__main__":
    asyncio.run(test_all_scrapers())
