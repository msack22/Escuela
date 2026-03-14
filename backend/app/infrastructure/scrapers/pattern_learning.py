"""
Sistema de aprendizaje automático de patrones de URLs
"""
import json
import re
from datetime import datetime
from typing import List, Dict, Set, Any
from pathlib import Path


class PatternLearning:
    """Sistema que aprende patrones de URLs y los guarda dinámicamente"""
    
    def __init__(self, patterns_file: str = "url_patterns.json"):
        backend_dir = Path(__file__).parent.parent.parent
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
                print(f"Error cargando patrones: {e}")
                return {}
        return {}
    
    def _save_patterns(self):
        """Guardar patrones aprendidos"""
        try:
            with open(self.patterns_file, 'w', encoding='utf-8') as f:
                json.dump(self.patterns_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error guardando patrones: {e}")
    
    def learn_from_url(self, url: str, title: str = ""):
        """Aprender patrones de una URL específica"""
        patterns = self.patterns_data.get('learned_patterns', [])
        
        # Extraer patrones de la URL
        new_patterns = self._extract_patterns_from_url(url, title)
        
        for pattern in new_patterns:
            # Verificar si ya existe
            if not any(p['pattern'] == pattern['pattern'] for p in patterns):
                patterns.append(pattern)
                print(f"🧠 Nuevo patrón aprendido: {pattern['type']} - {pattern['pattern']}")
        
        self.patterns_data['learned_patterns'] = patterns
        self.patterns_data['last_updated'] = datetime.now().isoformat()
        self._save_patterns()
        
        return new_patterns
    
    def _extract_patterns_from_url(self, url: str, title: str = "") -> List[Dict]:
        """Extraer patrones de una URL"""
        patterns = []
        
        # Patrón 1: convocatoria-escuela-{nivel}-n{numero}-{nombre}
        match1 = re.search(r'convocatoria-escuela-(\w+)-n(\d+)-([^/]+)', url, re.IGNORECASE)
        if match1:
            patterns.append({
                'type': 'convocatoria_escuela',
                'pattern': f'convocatoria-escuela-\\w+-n\\d+-[^/]+',
                'description': f'Convocatorias de escuelas {match1.group(1)}',
                'examples': [url],
                'confidence': 0.8,
                'created_at': datetime.now().isoformat()
            })
        
        # Patrón 2: convocatoria-horas-{materia}-{nivel}-n{numero}-{nombre}
        match2 = re.search(r'convocatoria-horas-([^/]+)-(\w+)-n(\d+)-([^/]+)', url, re.IGNORECASE)
        if match2:
            patterns.append({
                'type': 'convocatoria_horas',
                'pattern': f'convocatoria-horas-[^-]+-\\w+-n\\d+-[^/]+',
                'description': f'Convocatorias para horas de {match2.group(1)}',
                'examples': [url],
                'confidence': 0.9,
                'created_at': datetime.now().isoformat()
            })
        
        # Patrón 3: llamado-a-concurso-{tipo}
        match3 = re.search(r'llamado-a-concurso-([^/]+)', url, re.IGNORECASE)
        if match3:
            patterns.append({
                'type': 'llamado_concurso',
                'pattern': r'llamado-a-concurso-[^/]+',
                'description': f'Llamados a concurso {match3.group(1)}',
                'examples': [url],
                'confidence': 0.7,
                'created_at': datetime.now().isoformat()
            })
        
        # Patrón 4: concurso-cargo-{cargo}
        match4 = re.search(r'concurso-cargo-([^/]+)', url, re.IGNORECASE)
        if match4:
            patterns.append({
                'type': 'concurso_cargo',
                'pattern': f'concurso-cargo-[^/]+',
                'description': f'Concursos para cargo de {match4.group(1)}',
                'examples': [url],
                'confidence': 0.8,
                'created_at': datetime.now().isoformat()
            })
        
        return patterns
    
    def get_all_patterns(self) -> List[Dict]:
        """Obtener todos los patrones aprendidos"""
        return self.patterns_data.get('learned_patterns', [])
    
    def get_patterns_by_type(self, pattern_type: str) -> List[Dict]:
        """Obtener patrones por tipo"""
        all_patterns = self.get_all_patterns()
        return [p for p in all_patterns if p.get('type') == pattern_type]
    
    def search_with_patterns(self, text: str) -> List[Dict]:
        """Buscar coincidencias con patrones aprendidos"""
        matches = []
        patterns = self.get_all_patterns()
        
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
    
    def update_pattern_confidence(self, pattern_type: str, pattern_text: str, success: bool):
        """Actualizar confianza de un patrón basado en éxito"""
        patterns = self.get_patterns_by_type(pattern_type)
        
        for pattern in patterns:
            if pattern['pattern'] == pattern_text:
                # Incrementar o decrementar confianza
                if success:
                    pattern['confidence'] = min(1.0, pattern.get('confidence', 0.5) + 0.1)
                else:
                    pattern['confidence'] = max(0.1, pattern.get('confidence', 0.5) - 0.05)
                
                pattern['last_used'] = datetime.now().isoformat()
                break
        
        self._save_patterns()
        print(f"📊 Confianza actualizada para {pattern_type}: {pattern.get('confidence', 0):.2f}")
    
    def get_statistics(self) -> Dict:
        """Obtener estadísticas de aprendizaje"""
        patterns = self.get_all_patterns()
        
        stats = {
            'total_patterns': len(patterns),
            'patterns_by_type': {},
            'average_confidence': 0,
            'last_updated': self.patterns_data.get('last_updated')
        }
        
        # Agrupar por tipo
        for pattern in patterns:
            pattern_type = pattern.get('type', 'unknown')
            if pattern_type not in stats['patterns_by_type']:
                stats['patterns_by_type'][pattern_type] = 0
            stats['patterns_by_type'][pattern_type] += 1
        
        # Calcular confianza promedio
        if patterns:
            stats['average_confidence'] = sum(p.get('confidence', 0) for p in patterns) / len(patterns)
        
        return stats
