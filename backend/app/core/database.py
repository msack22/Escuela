from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

try:
    engine = create_engine(
        settings.database_url,
        echo=True,  # Enable SQL logging for debugging
        pool_pre_ping=True,  # Verify connections before use
        pool_recycle=3600,  # Recycle connections every hour
    )
    # Test connection
    with engine.connect() as conn:
        pass
    logger.info("Database connection successful")
    DB_AVAILABLE = True
except Exception as e:
    logger.error(f"Database connection failed: {e}")
    # Fallback to SQLite if MySQL is not available
    try:
        engine = create_engine(
            "sqlite:///./concursos_fallback.db",
            echo=True,
        )
        with engine.connect() as conn:
            pass
        logger.info("Using SQLite fallback database")
        DB_AVAILABLE = True
    except Exception as fallback_error:
        logger.error(f"SQLite fallback also failed: {fallback_error}")
        DB_AVAILABLE = False

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    if not DB_AVAILABLE:
        # Return None or raise a more descriptive error
        raise HTTPException(status_code=503, detail="Database service unavailable")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
