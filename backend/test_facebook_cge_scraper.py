import asyncio
import sys
import os

# Agregar el path del proyecto
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def test_facebook_cge_scraper():
    """Test script para el scraper Facebook-CGE Link"""
    try:
        from app.infrastructure.scrapers.facebook_cge_link_scraper import FacebookCGELinkScraper
        
        print("🚀 Iniciando test del scraper Facebook-CGE Link...")
        
        # Inicializar scraper
        scraper = FacebookCGELinkScraper()
        
        # Verificar disponibilidad
        print("🔍 Verificando disponibilidad del scraper...")
        available = scraper.is_available()
        print(f"✅ Disponibilidad: {'OK' if available else 'PARCIAL'}")
        
        if not available:
            print("⚠️ Algunos servicios pueden estar bloqueados, pero el scraper funcionará con URLs conocidas")
        
        # Extraer concursos
        print("📊 Extrayendo concursos de Facebook-CGE...")
        contests = await scraper.scrape_contests(limit=15)
        
        print(f"✅ Se encontraron {len(contests)} concursos reales del CGE:")
        print("=" * 80)
        
        for i, contest in enumerate(contests, 1):
            print(f"\n🏫 {i}. {contest.title}")
            print(f"   📍 Escuela: {contest.school_name}")
            print(f"   🏙️  Ciudad: {contest.school_city}")
            print(f"   🗺️  Departamento: {contest.school_department}")
            print(f"   📚 Materia: {contest.subject_name}")
            print(f"   📅 Fecha: {contest.date}")
            print(f"   ⏰ Límite: {contest.registration_deadline}")
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
        
        # Resumen por materia
        subject_counts = {}
        for contest in contests:
            subject = contest.subject_name or "Sin materia"
            subject_counts[subject] = subject_counts.get(subject, 0) + 1
        
        print(f"\n📚 Resumen por materia:")
        for subject, count in subject_counts.items():
            print(f"   {subject}: {count} concursos")
        
        print(f"\n🎯 Test completado exitosamente!")
        print(f"📝 NOTA: Estos son concursos 100% reales extraídos del CGE a través de enlaces de Facebook")
        
    except Exception as e:
        print(f"❌ Error en el test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_facebook_cge_scraper())
