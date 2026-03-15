#!/usr/bin/env python3

import asyncio
import sys
import os

# Agregar el directorio del backend al path
sys.path.append('/Users/matiassack/Documents/Matias/Escuela/backend')

try:
    from app.infrastructure.scrapers.datos_abiertos_scraper import DatosAbiertosArgentinaScraper
    
    async def test_scraper():
        scraper = DatosAbiertosArgentinaScraper()
        
        # Probar disponibilidad
        print("Verificando disponibilidad...")
        available = await scraper.is_available()
        print(f"API disponible: {available}")
        
        if available:
            # Probar scraping
            print("Iniciando scraping...")
            contests = await scraper.scrape_contests(limit=5)
            print(f"Total contests: {len(contests)}")
            
            for i, contest in enumerate(contests[:3]):
                print(f"Contest {i+1}: {contest.title}")
    
    asyncio.run(test_scraper())
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
