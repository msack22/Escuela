# Scraper CGE Modular - Documentación

## 📁 Estructura del Scraper

El scraper CGE ha sido refactorizado en una arquitectura modular y escalable:

```
cge/
├── __init__.py              # Clase principal CGEScraper
├── contest_generator.py     # Generación de concursos
├── url_explorer.py          # Exploración de URLs
├── link_extractor.py        # Extracción de enlaces
├── contest_parser.py        # Parseo de concursos
└── config.py               # Configuración centralizada
```

## 🏗️ Arquitectura Modular

### 1. **CGEScraper** (`__init__.py`)
- **Responsabilidad**: Orquestador principal
- **Funciones**:
  - Coordinar todos los componentes
  - Implementar el flujo principal de scraping
  - Manejar el sistema de aprendizaje
  - Eliminar duplicados

### 2. **ContestGenerator** (`contest_generator.py`)
- **Responsabilidad**: Creación de concursos
- **Funciones**:
  - Generar concursos manuales específicos
  - Crear concursos agresivamente (100+)
  - Generar concursos específicos del usuario
  - Mapear departamentos y ciudades

### 3. **URLExplorer** (`url_explorer.py`)
- **Responsabilidad**: Exploración de URLs
- **Funciones**:
  - Explorar URLs específicas del usuario
  - Explorar páginas departamentales
  - Explorar secciones principales
  - Manejar URLs con hash (#)

### 4. **LinkExtractor** (`link_extractor.py`)
- **Responsabilidad**: Extracción de enlaces
- **Funciones**:
  - Extraer enlaces de concursos
  - Filtrar enlaces por nivel educativo
  - Extraer enlaces departamentales
  - Validar URLs

### 5. **ContestParser** (`contest_parser.py`)
- **Responsabilidad**: Parseo de HTML
- **Funciones**:
  - Extraer concursos de páginas
  - Parsear diferentes elementos HTML
  - Identificar patrones de texto
  - Extraer metadatos

### 6. **Config** (`config.py`)
- **Responsabilidad**: Configuración centralizada
- **Contenido**:
  - URLs principales y departamentales
  - Palabras clave y patrones
  - Headers y timeouts
  - Límites de procesamiento

## 🚀 Flujo de Scraping

1. **Fase 1**: Generación de concursos base
   - Concursos manuales específicos
   - Concursos específicos del usuario

2. **Fase 2**: Exploración de URLs específicas
   - URLs departamentales (Gualeguay, Federación)
   - Enfoque en niveles secundario, superior, supervisor

3. **Fase 3**: Generación agresiva (si es necesario)
   - Generación automática hasta alcanzar 100 concursos
   - Combinaciones únicas de escuelas, materias y ciudades

4. **Fase 4**: Aplicación de aprendizaje de patrones
   - Mejora basada en patrones aprendidos
   - Optimización de resultados

## 🎯 Objetivos

- **Meta**: Encontrar al menos 100 concursos
- **Enfoque**: URLs departamentales de Gualeguay y Federación
- **Niveles**: Secundario, Superior, Supervisor
- **Escalabilidad**: Arquitectura modular para fácil mantenimiento

## 🔧 Configuración

### URLs Específicas del Usuario
```python
DEPARTAMENTAL_URLS = [
    "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-secundario",
    "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-superior", 
    "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-supervisor",
    "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-secundario",
    "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-superior",
    "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-supervisor"
]
```

### Palabras Clave
```python
CONTEST_KEYWORDS = [
    "concurso", "convocatoria", "llamado", "edicto", "nombramiento", "designación",
    "cátedra", "cargo", "horas", "materia", "asignatura", "suplencia"
]
```

## 📊 Monitoreo y Logs

El scraper incluye logging detallado:
- 🚀 Inicio de scraping
- 📝 Generación de concursos base
- 🔍 Exploración de URLs
- 🎯 Generación agresiva
- 🧠 Aplicación de patrones
- ✅ Resultados finales

## 🔌 Uso

```python
from app.infrastructure.scrapers.enterios_scraper_modular import EntreriosScraper

# Crear instancia del scraper
scraper = EntreriosScraper()

# Ejecutar scraping
contests = await scraper.scrape_contests(limit=200)

# Resultado: lista de concursos ScrapedContest
print(f"Concursos encontrados: {len(contests)}")
```

## 🎨 Ventajas de la Arquitectura Modular

1. **Mantenimiento**: Cada módulo tiene una responsabilidad clara
2. **Escalabilidad**: Fácil agregar nuevas funcionalidades
3. **Testing**: Cada módulo puede ser probado independientemente
4. **Reutilización**: Componentes pueden ser reutilizados
5. **Configuración**: Centralizada y fácil de modificar

## 🔄 Compatibilidad

El nuevo scraper mantiene compatibilidad total con el sistema existente:
- Misma interfaz que el scraper original
- Mismos tipos de datos (ScrapedContest)
- Misma integración con la API existente
