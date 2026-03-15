#!/usr/bin/env python3

import sys
import os
sys.path.append('/Users/matiassack/Documents/Matias/Escuela/backend')

from app.infrastructure.scrapers.enterios_scraper import EntreriosScraper
import asyncio

async def test_scraper():
    scraper = EntreriosScraper()
    
    print("🚀 Probando scraper CGE...")
    
    # Ejecutar scraper con límite alto para forzar generación agresiva
    contests = await scraper.scrape_contests(limit=200)
    
    print(f"📊 Total de concursos generados: {len(contests)}")
    
    # Mostrar primeros 10 concursos
    for i, contest in enumerate(contests[:10]):
        print(f"{i+1}. {contest.title}")
    
    # Verificar concursos de Gualeguay y Federación
    gualeguay_contests = [c for c in contests if "Gualeguay" in c.title]
    federacion_contests = [c for c in contests if "Federacion" in c.title]
    
    print(f"\n🎯 Concursos de Gualeguay: {len(gualeguay_contests)}")
    print(f"🎯 Concursos de Federación: {len(federacion_contests)}")
    
    return contests

if __name__ == "__main__":
    result = asyncio.run(test_scraper())
    print(f"✅ Scraper probado con {len(result)} concursos")
