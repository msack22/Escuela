"""
Sistema de caché para URLs exploradas por los scrapers
"""
import json
import os
from datetime import datetime, timedelta
from typing import Set, Dict, List
from pathlib import Path


class URLCache:
    """Gestiona caché de URLs exploradas para evitar repetición"""
    
    def __init__(self, cache_file: str = "url_cache.json"):
        # Usar el directorio del backend para el caché
        backend_dir = Path(__file__).parent.parent.parent
        self.cache_file = backend_dir / cache_file
        
        # Crear directorio data si no existe
        self.cache_file.parent.mkdir(exist_ok=True)
        
        self.cache_data = self._load_cache()
    
    def _load_cache(self) -> Dict:
        """Cargar caché desde archivo"""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error cargando caché: {e}")
                return {}
        return {}
    
    def _save_cache(self):
        """Guardar caché a archivo"""
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.cache_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error guardando caché: {e}")
    
    def is_url_explored(self, scraper_name: str, url: str, max_age_days: int = 7) -> bool:
        """Verificar si URL ya fue explorada recientemente"""
        scraper_cache = self.cache_data.get(scraper_name, {})
        url_info = scraper_cache.get(url)
        
        if not url_info:
            return False
        
        # Verificar si la exploración es reciente
        last_explored = datetime.fromisoformat(url_info.get('last_explored', '2020-01-01'))
        age = datetime.now() - last_explored
        
        return age.days < max_age_days
    
    def mark_url_explored(self, scraper_name: str, url: str, contests_found: int = 0):
        """Marcar URL como explorada"""
        if scraper_name not in self.cache_data:
            self.cache_data[scraper_name] = {}
        
        self.cache_data[scraper_name][url] = {
            'last_explored': datetime.now().isoformat(),
            'contests_found': contests_found,
            'times_explored': self.cache_data[scraper_name].get(url, {}).get('times_explored', 0) + 1
        }
        
        self._save_cache()
    
    def get_unexplored_urls(self, scraper_name: str, all_urls: List[str], max_age_days: int = 7) -> List[str]:
        """Obtener URLs no exploradas recientemente"""
        unexplored = []
        
        for url in all_urls:
            if not self.is_url_explored(scraper_name, url, max_age_days):
                unexplored.append(url)
        
        return unexplored
    
    def get_exploration_stats(self, scraper_name: str) -> Dict:
        """Obtener estadísticas de exploración"""
        scraper_cache = self.cache_data.get(scraper_name, {})
        
        total_urls = len(scraper_cache)
        total_contests = sum(info.get('contests_found', 0) for info in scraper_cache.values())
        
        # URLs exploradas en últimos 7 días
        recent_urls = [
            url for url, info in scraper_cache.items()
            if (datetime.now() - datetime.fromisoformat(info.get('last_explored', '2020-01-01'))).days < 7
        ]
        
        return {
            'total_urls_explored': total_urls,
            'total_contests_found': total_contests,
            'recently_explored': len(recent_urls),
            'average_contests_per_url': total_contests / total_urls if total_urls > 0 else 0
        }
    
    def cleanup_old_entries(self, max_age_days: int = 30):
        """Limpiar entradas antiguas del caché"""
        cutoff_date = datetime.now() - timedelta(days=max_age_days)
        
        for scraper_name in list(self.cache_data.keys()):
            scraper_cache = self.cache_data[scraper_name]
            
            for url in list(scraper_cache.keys()):
                url_info = scraper_cache[url]
                last_explored = datetime.fromisoformat(url_info.get('last_explored', '2020-01-01'))
                
                if last_explored < cutoff_date:
                    del scraper_cache[url]
            
            if not scraper_cache:  # Eliminar scraper si no tiene URLs
                del self.cache_data[scraper_name]
        
        self._save_cache()
        print(f"🧹 Limpieza de caché completada. Entradas más antiguas de {max_age_days} días eliminadas.")
