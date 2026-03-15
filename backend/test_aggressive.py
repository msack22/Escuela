#!/usr/bin/env python3

import sys
import os
sys.path.append('/Users/matiassack/Documents/Matias/Escuela/backend')

from app.infrastructure.scrapers.enterios_scraper import EntreriosScraper
import asyncio

async def test_aggressive_generation():
    scraper = EntreriosScraper()
    
    print("🚀 Probando generación agresiva de concursos...")
    
    # Probar solo la generación agresiva
    aggressive_contests = scraper._generate_aggressive_contests()
    
    print(f"📊 Total de concursos generados agresivamente: {len(aggressive_contests)}")
    
    # Mostrar primeros 10 concursos
    for i, contest in enumerate(aggressive_contests[:10]):
        print(f"{i+1}. {contest.title}")
    
    # Verificar concursos de Gualeguay y Federación
    gualeguay_contests = [c for c in aggressive_contests if "Gualeguay" in c.title]
    federacion_contests = [c for c in aggressive_contests if "Federacion" in c.title]
    
    print(f"\n🎯 Concursos de Gualeguay: {len(gualeguay_contests)}")
    print(f"🎯 Concursos de Federación: {len(federacion_contests)}")
    
    return aggressive_contests

if __name__ == "__main__":
    result = asyncio.run(test_aggressive_generation())
    print(f"✅ Generación agresiva probada con {len(result)} concursos")
