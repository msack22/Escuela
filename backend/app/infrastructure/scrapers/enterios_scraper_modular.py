"""
Scraper CGE modular - Reemplazo del scraper monolítico
Este archivo mantiene compatibilidad con la API existente
"""

import logging
from typing import List, Optional

from .cge import CGEScraper

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Mantener compatibilidad con el sistema existente
class EntreriosScraper(CGEScraper):
    """
    Wrapper para mantener compatibilidad con el sistema existente
    Hereda del nuevo scraper CGE modular
    """
    pass
