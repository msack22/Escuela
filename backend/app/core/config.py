from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    database_url: str = "mysql+pymysql://root:tu_password@localhost:3306/concursos_db"
    
    # Redis (opcional para desarrollo)
    redis_url: str = "redis://localhost:6379/0"
    
    # API Keys
    google_maps_api_key: Optional[str] = None
    sendgrid_api_key: Optional[str] = None
    sender_email: Optional[str] = None
    brevo_api_key: Optional[str] = None
    
    # Security
    secret_key: str = "your-secret-key-here"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Scraping
    scraping_interval_hours: int = 2
    max_concurrent_scrapers: int = 5
    
    # User location (for distance calculations)
    user_latitude: float = -34.6037  # Buenos Aires default
    user_longitude: float = -58.3816
    
    class Config:
        env_file = ".env"


settings = Settings()
