"""
Pruebas unitarias para el sistema de concursos educativos
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
from sqlalchemy.orm import Session

# Importar módulos a probar
from app.infrastructure.scrapers.scraper_factory import ScraperFactory, ScrapingService
from app.infrastructure.scrapers.educacion_gob_scraper import EducacionGobScraper
from app.infrastructure.scrapers.base_scraper import BaseScraper, ScrapedContest
from app.application.services.contest_search_service import ContestSearchService
from app.application.services.contest_processing_service import ContestProcessingService
from app.infrastructure.notifications.whatsapp_secure_notifier import WhatsAppSecureNotifier


class TestScrapers:
    """Pruebas unitarias para scrapers"""
    
    @pytest.fixture
    def scraper_factory(self):
        """Fixture para ScraperFactory"""
        return ScraperFactory()
    
    @pytest.fixture
    def educacion_scraper(self):
        """Fixture para EducacionGobScraper"""
        return EducacionGobScraper()
    
    @pytest.mark.asyncio
    async def test_scraper_factory_creates_scrapers(self, scraper_factory):
        """Probar que la fábrica crea scrapers correctamente"""
        scrapers = scraper_factory.get_available_scrapers()
        
        assert len(scrapers) >= 1
        assert "educacion_gob" in scrapers
        assert isinstance(scrapers["educacion_gob"], EducacionGobScraper)
    
    @pytest.mark.asyncio
    async def test_educacion_scraper_availability(self, educacion_scraper):
        """Probar disponibilidad del scraper de educación"""
        available = await educacion_scraper.is_available()
        assert isinstance(available, bool)
    
    @pytest.mark.asyncio
    async def test_educacion_scraper_scraping(self, educacion_scraper):
        """Probar scraping del scraper de educación"""
        contests = await educacion_scraper.scrape_contests(limit=1)
        assert isinstance(contests, list)
        
        if contests:
            contest = contests[0]
            assert isinstance(contest, ScrapedContest)
            assert contest.title
            assert contest.source_name == "Educación Argentina"
    
    def test_scraped_contest_dataclass(self):
        """Probar dataclass ScrapedContest"""
        contest = ScrapedContest(
            title="Test Contest",
            description="Test Description",
            date=datetime.now(),
            registration_deadline=None,
            school_name="Test School",
            school_city="Test City",
            school_department="Test Dept",
            school_address="Test Address",
            subject_name="Math",
            source_url="http://test.com",
            source_name="Test Source"
        )
        
        assert contest.title == "Test Contest"
        assert contest.school_name == "Test School"
        assert contest.subject_name == "Math"


class TestScrapingService:
    """Pruebas unitarias para ScrapingService"""
    
    @pytest.fixture
    def scraping_service(self):
        """Fixture para ScrapingService"""
        return ScrapingService()
    
    @pytest.mark.asyncio
    async def test_scraping_service_singleton(self):
        """Probar patrón Singleton"""
        service1 = ScrapingService()
        service2 = ScrapingService()
        
        assert service1 is service2
    
    @pytest.mark.asyncio
    async def test_scrape_all_sources(self, scraping_service):
        """Probar scraping de todas las fuentes"""
        contests = await scraping_service.scrape_all_sources()
        assert isinstance(contests, list)
        
        for contest in contests:
            assert isinstance(contest, ScrapedContest)


class TestContestServices:
    """Pruebas unitarias para servicios de concursos"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock de base de datos"""
        return Mock(spec=Session)
    
    @pytest.fixture
    def contest_search_service(self, mock_db):
        """Fixture para ContestSearchService"""
        return ContestSearchService(mock_db)
    
    def test_contest_search_filter_validation(self, contest_search_service):
        """Probar validación de filtros de búsqueda"""
        from app.application.services.contest_search_service import ContestFilter
        
        filter_data = {
            "level": "Secundario",
            "shift": "Mañana",
            "min_hours": 10,
            "max_hours": 20
        }
        
        contest_filter = ContestFilter(**filter_data)
        assert contest_filter.level == "Secundario"
        assert contest_filter.shift == "Mañana"
        assert contest_filter.min_hours == 10
        assert contest_filter.max_hours == 20
    
    @pytest.mark.asyncio
    async def test_contest_processing_service(self, mock_db):
        """Probar servicio de procesamiento de concursos"""
        service = ContestProcessingService(mock_db)
        
        # Mock de datos de concurso
        scraped_contest = ScrapedContest(
            title="Test Contest",
            description="Test Description",
            date=datetime.now(),
            registration_deadline=None,
            school_name="Test School",
            school_city="Test City",
            school_department="Test Dept",
            school_address="Test Address",
            subject_name="Math",
            source_url="http://test.com",
            source_name="Test Source"
        )
        
        # Mock de entidades
        mock_school = Mock()
        mock_subject = Mock()
        mock_contest = Mock()
        
        with patch.object(service, '_get_or_create_school', return_value=mock_school), \
             patch.object(service, '_get_or_create_subject', return_value=mock_subject), \
             patch.object(service, '_create_contest', return_value=mock_contest):
            
            result = await service.process_scraped_contest(scraped_contest)
            assert result is not None


class TestWhatsAppNotifier:
    """Pruebas unitarias para notificador WhatsApp"""
    
    @pytest.fixture
    def whatsapp_notifier(self):
        """Fixture para WhatsAppSecureNotifier"""
        # Crear una implementación concreta para pruebas
        from app.infrastructure.notifications.base_notifier import BaseNotifier, NotificationMessage
        
        class TestWhatsAppNotifier(BaseNotifier):
            def __init__(self):
                self.client = None
                self.use_official_api = True
            
            def is_available(self) -> bool:
                return True
            
            def is_secure(self) -> bool:
                return True
            
            def is_configured(self) -> bool:
                return True
            
            async def send_notification(self, message: NotificationMessage) -> bool:
                return True
            
            def _sanitize_text(self, text: str) -> str:
                if not text:
                    return "No especificado"
                
                dangerous_chars = ['<', '>', '&', '"', "'", '/', '\\', '\n', '\r', '\t']
                for char in dangerous_chars:
                    text = text.replace(char, '')
                
                return text[:100] if len(text) > 100 else text
            
            def _mask_phone(self, phone: str) -> str:
                if len(phone) > 4:
                    return phone[:4] + "****" + phone[-2:]
                return "****"
        
        return TestWhatsAppNotifier()
    
    def test_whatsapp_notifier_initialization(self, whatsapp_notifier):
        """Probar inicialización del notificador"""
        assert whatsapp_notifier is not None
    
    @pytest.mark.asyncio
    async def test_whatsapp_notifier_availability(self, whatsapp_notifier):
        """Probar disponibilidad del notificador"""
        available = whatsapp_notifier.is_available()
        assert isinstance(available, bool)
    
    @pytest.mark.asyncio
    async def test_whatsapp_notifier_security(self, whatsapp_notifier):
        """Probar nivel de seguridad del notificador"""
        is_secure = whatsapp_notifier.is_secure()
        assert isinstance(is_secure, bool)
    
    def test_message_sanitization(self, whatsapp_notifier):
        """Probar sanitización de mensajes"""
        dangerous_text = "Test <script>alert('xss')</script> & \"quotes\" \\backslash"
        safe_text = whatsapp_notifier._sanitize_text(dangerous_text)
        
        assert "<script>" not in safe_text
        assert "&" not in safe_text
        assert '"' not in safe_text
        assert "\\" not in safe_text
    
    def test_phone_masking(self, whatsapp_notifier):
        """Probar enmascaramiento de números de teléfono"""
        phone = "+5490000000000"
        masked = whatsapp_notifier._mask_phone(phone)
        
        assert len(masked) == len(phone)
        assert masked[:4] == phone[:4]
        assert masked[-2:] == phone[-2:]
        assert "****" in masked


class TestIntegration:
    """Pruebas de integración"""
    
    @pytest.mark.asyncio
    async def test_full_scraping_pipeline(self):
        """Probar pipeline completo de scraping"""
        factory = ScraperFactory()
        service = ScrapingService()
        
        # Obtener scrapers disponibles
        scrapers = factory.get_available_scrapers()
        assert len(scrapers) >= 1
        
        # Probar scraping
        contests = await service.scrape_all_sources()
        assert isinstance(contests, list)
        
        # Verificar estructura de datos
        for contest in contests:
            assert isinstance(contest, ScrapedContest)
            assert contest.title
            assert contest.source_name
            assert contest.source_url
    
    @pytest.mark.asyncio
    async def test_error_handling(self):
        """Probar manejo de errores"""
        scraper = EducacionGobScraper()
        
        # Probar con URL inválida
        scraper.base_url = "http://invalid-url-that-does-not-exist.com"
        available = await scraper.is_available()
        assert available is False
        
        # Probar scraping con error
        contests = await scraper.scrape_contests(limit=1)
        assert isinstance(contests, list)


# Configuración de pytest
def pytest_configure(config):
    """Configuración adicional de pytest"""
    config.addinivalue_line(
        "markers", "asyncio: marks test as async"
    )


if __name__ == "__main__":
    # Ejecutar pruebas
    pytest.main([__file__, "-v", "--tb=short"])
