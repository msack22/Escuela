import asyncio
import sys
import os

# Agregar el path del proyecto
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def test_cge_scraper_v2():
    """Test script para el nuevo scraper CGE V2"""
    try:
        from app.infrastructure.scrapers.cge_scraper_v2 import CGEEntreriosScraperV2
        
        print("🚀 Iniciando test del scraper CGE V2...")
        
        # Inicializar scraper
        scraper = CGEEntreriosScraperV2()
        
        # Verificar disponibilidad
        print("🔍 Verificando disponibilidad del scraper...")
        available = scraper.is_available()
        print(f"✅ Disponibilidad: {'OK' if available else 'ERROR'}")
        
        if not available:
            print("❌ El scraper no está disponible. Verifique la conexión.")
            return
        
        # Extraer concursos (limitado para testing)
        print("📊 Extrayendo concursos reales...")
        contests = await scraper.scrape_contests(limit=10)
        
        print(f"✅ Se encontraron {len(contests)} concursos reales:")
        print("=" * 80)
        
        for i, contest in enumerate(contests, 1):
            print(f"\n🏫 {i}. {contest.title}")
            print(f"   📍 Escuela: {contest.school_name}")
            print(f"   🏙️  Departamento: {contest.school_department}")
            print(f"   📚 Materia: {contest.subject_name}")
            print(f"   📅 Fecha: {contest.date}")
            print(f"   🔗 URL: {contest.source_url}")
            print("-" * 60)
        
        # Resumen por departamento
        dept_counts = {}
        for contest in contests:
            dept = contest.school_department or "Sin departamento"
            dept_counts[dept] = dept_counts.get(dept, 0) + 1
        
        print(f"\n📈 Resumen por departamento:")
        for dept, count in dept_counts.items():
            print(f"   {dept}: {count} concursos")
        
        print(f"\n🎯 Test completado exitosamente!")
        
    except Exception as e:
        print(f"❌ Error en el test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_cge_scraper_v2())
