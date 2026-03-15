#!/usr/bin/env python3

import sys
import os
sys.path.append('/Users/matiassack/Documents/Matias/Escuela/backend')

import asyncio
from app.infrastructure.scrapers.enterios_scraper_modular import EntreriosScraper

async def test_modular_scraper():
    """Probar el nuevo scraper modular CGE"""
    print("🚀 Probando scraper CGE modular...")
    
    scraper = EntreriosScraper()
    
    # Verificar disponibilidad
    available = await scraper.is_available()
    print(f"📡 Disponibilidad del scraper: {available}")
    
    if available:
        # Ejecutar scraping con límite alto
        contests = await scraper.scrape_contests(limit=150)
        
        print(f"📊 Total de concursos generados: {len(contests)}")
        
        # Mostrar primeros 10 concursos
        print("\n📋 Primeros 10 concursos:")
        for i, contest in enumerate(contests[:10]):
            print(f"{i+1}. {contest.title}")
        
        # Verificar concursos de Gualeguay y Federación
        gualeguay_contests = [c for c in contests if "Gualeguay" in c.title]
        federacion_contests = [c for c in contests if "Federacion" in c.title]
        
        print(f"\n🎯 Concursos de Gualeguay: {len(gualeguay_contests)}")
        print(f"🎯 Concursos de Federación: {len(federacion_contests)}")
        
        # Verificar niveles
        secundario_contests = [c for c in contests if "Secundario" in c.title]
        superior_contests = [c for c in contests if "Superior" in c.title]
        supervisor_contests = [c for c in contests if "Supervisor" in c.title]
        
        print(f"🎓 Concursos Secundario: {len(secundario_contests)}")
        print(f"🎓 Concursos Superior: {len(superior_contests)}")
        print(f"🎓 Concursos Supervisor: {len(supervisor_contests)}")
        
        return contests
    else:
        print("❌ El scraper no está disponible")
        return []

if __name__ == "__main__":
    result = asyncio.run(test_modular_scraper())
    print(f"✅ Scraper modular probado con {len(result)} concursos")
