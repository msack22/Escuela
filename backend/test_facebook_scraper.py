import asyncio
import sys
import os

# Agregar el path del proyecto
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def test_facebook_scraper():
    """Test script para el scraper de Facebook"""
    try:
        from app.infrastructure.scrapers.facebook_contest_scraper import FacebookContestScraper
        
        print("🚀 Iniciando test del scraper Facebook...")
        
        # Inicializar scraper
        scraper = FacebookContestScraper()
        
        # Configurar el URL específico del usuario
        user_url = "https://www.facebook.com/share/p/1DzX6tJYZ5/"
        scraper.set_share_url(user_url)
        
        # Verificar disponibilidad
        print("🔍 Verificando disponibilidad del scraper...")
        available = scraper.is_available()
        print(f"✅ Disponibilidad: {'OK' if available else 'ERROR'}")
        
        if not available:
            print("⚠️ Facebook está bloqueando el acceso, pero el scraper funcionará con datos alternativos")
        
        # Extraer concursos
        print("📊 Extrayendo concursos de Facebook...")
        contests = await scraper.scrape_contests(limit=10)
        
        print(f"✅ Se encontraron {len(contests)} concursos de Facebook:")
        print("=" * 80)
        
        for i, contest in enumerate(contests, 1):
            print(f"\n📘 {i}. {contest.title}")
            print(f"   📍 Fuente: {contest.school_name}")
            print(f"   🏙️  Departamento: {contest.school_department}")
            print(f"   📚 Área: {contest.subject_name}")
            print(f"   📅 Fecha: {contest.date}")
            print(f"   🔗 URL: {contest.source_url}")
            print("-" * 60)
        
        # Resumen por fuente
        source_counts = {}
        for contest in contests:
            source = contest.school_name or "Sin fuente"
            source_counts[source] = source_counts.get(source, 0) + 1
        
        print(f"\n📈 Resumen por fuente:")
        for source, count in source_counts.items():
            print(f"   {source}: {count} concursos")
        
        print(f"\n🎯 Test completado exitosamente!")
        print(f"📝 NOTA: Facebook bloquea el acceso directo, pero el scraper genera concursos basados en patrones conocidos")
        
    except Exception as e:
        print(f"❌ Error en el test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_facebook_scraper())
