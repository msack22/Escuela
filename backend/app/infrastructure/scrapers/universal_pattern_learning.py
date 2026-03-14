"""
Sistema universal de aprendizaje de patrones para todos los scrapers
"""
import json
import re
from datetime import datetime
from typing import List, Dict, Set
from pathlib import Path


class UniversalPatternLearning:
    """Sistema universal que aprende patrones de todos los scrapers"""
    
    def __init__(self, patterns_file: str = "universal_patterns.json"):
        backend_dir = Path(__file__).parent.parent
        self.patterns_file = backend_dir / patterns_file
        self.patterns_file.parent.mkdir(exist_ok=True)
        self.patterns_data = self._load_patterns()
    
    def _load_patterns(self) -> Dict:
        """Cargar patrones guardados"""
        if self.patterns_file.exists():
            try:
                with open(self.patterns_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error cargando patrones universales: {e}")
                return {}
        return {}
    
    def _save_patterns(self):
        """Guardar patrones aprendidos"""
        try:
            with open(self.patterns_file, 'w', encoding='utf-8') as f:
                json.dump(self.patterns_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error guardando patrones universales: {e}")
    
    def learn_from_url(self, scraper_name: str, url: str, title: str = "", content: str = ""):
        """Aprender patrones de una URL específica para cualquier scraper"""
        if scraper_name not in self.patterns_data:
            self.patterns_data[scraper_name] = {
                'learned_patterns': [],
                'last_updated': datetime.now().isoformat(),
                'total_urls_learned': 0
            }
        
        patterns = self.patterns_data[scraper_name]['learned_patterns']
        new_patterns = self._extract_patterns_from_url(url, title, content)
        
        for pattern in new_patterns:
            # Verificar si ya existe
            if not any(p['pattern'] == pattern['pattern'] for p in patterns):
                patterns.append(pattern)
                print(f"🧠 {scraper_name}: Nuevo patrón aprendido - {pattern['type']}")
        
        self.patterns_data[scraper_name]['learned_patterns'] = patterns
        self.patterns_data[scraper_name]['last_updated'] = datetime.now().isoformat()
        self.patterns_data[scraper_name]['total_urls_learned'] += 1
        self._save_patterns()
        
        return new_patterns
    
    def _extract_patterns_from_url(self, url: str, title: str = "", content: str = "") -> List[Dict]:
        """Extraer patrones universales de una URL"""
        patterns = []
        
        # Patrones universales de concursos
        contest_patterns = [
            (r'convocatoria-escuela-(\w+)-n(\d+)-([^/]+)', 'convocatoria_escuela'),
            (r'concurso-cargo-([^/]+)', 'concurso_cargo'),
            (r'llamado-a-concurso-([^/]+)', 'llamado_concurso'),
            (r'convocatoria-horas-([^/]+)', 'convocatoria_horas'),
            (r'edicto-(\w+)-(\d+)', 'edicto'),
            (r'resolucion-(\w+)-(\d+)', 'resolucion'),
            (r'disposicion-(\w+)-(\d+)', 'disposicion'),
            (r'nombramiento-(\w+)', 'nombramiento'),
            (r'designacion-(\w+)', 'designacion')
        ]
        
        # Patrones universales de diplomaturas/capacitaciones
        diploma_patterns = [
            (r'diplomatura-(\w+)', 'diplomatura'),
            (r'capacitacion-(\w+)', 'capacitacion'),
            (r'curso-(\w+)', 'curso'),
            (r'posgrado-(\w+)', 'posgrado'),
            (r'especializacion-(\w+)', 'especializacion'),
            (r'actualizacion-(\w+)', 'actualizacion'),
            (r'perfeccionamiento-(\w+)', 'perfeccionamiento'),
            (r'formacion-(\w+)', 'formacion')
        ]
        
        # Patrones específicos de Facebook
        facebook_patterns = [
            (r'facebook\.com/dde\w+', 'facebook_dde'),
            (r'facebook\.com/cge\w+', 'facebook_cge'),
            (r'facebook\.com/educacion\w+', 'facebook_educacion'),
            (r'facebook\.com/amet\w+', 'facebook_amet'),
            (r'facebook\.com/escuela\w+', 'facebook_escuela'),
            (r'facebook\.com/colegio\w+', 'facebook_colegio'),
            (r'facebook\.com/instituto\w+', 'facebook_instituto')
        ]
        
        # Patrones específicos de sitios educativos
        educational_patterns = [
            (r'cge\.entrerios\.gov\.ar/\d{4}/\d{2}/', 'cge_entrerios'),
            (r'educacion\.gov\.ar/\w+', 'educacion_argentina'),
            (r'amet\.org\.ar/\w+', 'amet_argentina'),
            (r'(\w+)\.gov\.ar/\w+', 'sitio_gubernamental'),
            (r'(\w+)\.edu\.ar/\w+', 'sitio_educativo')
        ]
        
        all_patterns = contest_patterns + diploma_patterns + facebook_patterns + educational_patterns
        
        for pattern, pattern_type in all_patterns:
            match = re.search(pattern, url, re.IGNORECASE)
            if match:
                patterns.append({
                    'type': pattern_type,
                    'pattern': pattern,
                    'description': f'Patrón {pattern_type} detectado',
                    'examples': [url],
                    'confidence': 0.8,
                    'created_at': datetime.now().isoformat(),
                    'match_groups': match.groups() if match.groups() else []
                })
        
        return patterns
    
    def get_patterns_for_scraper(self, scraper_name: str) -> List[Dict]:
        """Obtener patrones aprendidos para un scraper específico"""
        return self.patterns_data.get(scraper_name, {}).get('learned_patterns', [])
    
    def search_patterns_in_text(self, scraper_name: str, text: str) -> List[Dict]:
        """Buscar coincidencias de patrones en texto"""
        patterns = self.get_patterns_for_scraper(scraper_name)
        matches = []
        
        for pattern in patterns:
            try:
                if re.search(pattern['pattern'], text, re.IGNORECASE):
                    matches.append({
                        'pattern': pattern,
                        'match_text': text,
                        'confidence': pattern.get('confidence', 0.5)
                    })
            except Exception as e:
                print(f"Error buscando patrón {pattern['type']}: {e}")
        
        return matches
    
    def update_pattern_confidence(self, scraper_name: str, pattern_type: str, success: bool):
        """Actualizar confianza de un patrón basado en éxito"""
        patterns = self.get_patterns_for_scraper(scraper_name)
        
        for pattern in patterns:
            if pattern['type'] == pattern_type:
                if success:
                    pattern['confidence'] = min(1.0, pattern.get('confidence', 0.5) + 0.1)
                else:
                    pattern['confidence'] = max(0.1, pattern.get('confidence', 0.5) - 0.05)
                
                pattern['last_used'] = datetime.now().isoformat()
                break
        
        self._save_patterns()
        print(f"📊 {scraper_name}: Confianza actualizada para {pattern_type}: {pattern.get('confidence', 0):.2f}")
    
    def get_statistics(self) -> Dict:
        """Obtener estadísticas de aprendizaje universal"""
        stats = {
            'scrapers': {},
            'total_patterns': 0,
            'total_urls_learned': 0,
            'last_updated': None
        }
        
        for scraper_name, data in self.patterns_data.items():
            scraper_patterns = data.get('learned_patterns', [])
            stats['scrapers'][scraper_name] = {
                'patterns_count': len(scraper_patterns),
                'urls_learned': data.get('total_urls_learned', 0),
                'last_updated': data.get('last_updated'),
                'patterns_by_type': {}
            }
            
            # Agrupar patrones por tipo
            for pattern in scraper_patterns:
                pattern_type = pattern.get('type', 'unknown')
                if pattern_type not in stats['scrapers'][scraper_name]['patterns_by_type']:
                    stats['scrapers'][scraper_name]['patterns_by_type'][pattern_type] = 0
                stats['scrapers'][scraper_name]['patterns_by_type'][pattern_type] += 1
            
            stats['total_patterns'] += len(scraper_patterns)
            stats['total_urls_learned'] += data.get('total_urls_learned', 0)
            
            if not stats['last_updated'] or data.get('last_updated', '') > stats['last_updated']:
                stats['last_updated'] = data.get('last_updated')
        
        return stats
    
    def export_patterns(self, filename: str = "exported_patterns.json"):
        """Exportar todos los patrones aprendidos"""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(self.patterns_data, f, indent=2, ensure_ascii=False)
            print(f"✅ Patrones exportados a {filename}")
        except Exception as e:
            print(f"Error exportando patrones: {e}")
    
    def import_patterns(self, filename: str):
        """Importar patrones desde archivo"""
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                imported_data = json.load(f)
            
            # Fusionar con datos existentes
            for scraper_name, data in imported_data.items():
                if scraper_name not in self.patterns_data:
                    self.patterns_data[scraper_name] = data
                else:
                    # Fusionar patrones
                    existing_patterns = self.patterns_data[scraper_name].get('learned_patterns', [])
                    imported_patterns = data.get('learned_patterns', [])
                    
                    for pattern in imported_patterns:
                        if not any(p['pattern'] == pattern['pattern'] for p in existing_patterns):
                            existing_patterns.append(pattern)
                    
                    self.patterns_data[scraper_name]['learned_patterns'] = existing_patterns
            
            self._save_patterns()
            print(f"✅ Patrones importados desde {filename}")
        except Exception as e:
            print(f"Error importando patrones: {e}")
