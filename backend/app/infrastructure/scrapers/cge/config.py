"""
Configuración del scraper CGE
Define URLs, patrones y parámetros de configuración
"""

# URLs principales del CGE
MAIN_URLS = [
    "https://cge.entrerios.gov.ar/concursos/",
    "https://cge.entrerios.gov.ar/noticias/",
    "https://cge.entrerios.gov.ar/jurado-de-concursos-noticias/",
    "https://cge.entrerios.gov.ar/2026/03/",
    "https://cge.entrerios.gov.ar/2026/02/",
    "https://cge.entrerios.gov.ar/2026/01/"
]

# URLs departamentales específicas del usuario
DEPARTAMENTAL_URLS = [
    # Gualeguaychú - Enfoque principal
    "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-secundario",
    "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-superior", 
    "https://cge.entrerios.gov.ar/departamental-gualeguay/#concursos-nivel-supervisor",
    
    # Federación - Enfoque principal
    "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-secundario",
    "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-superior",
    "https://cge.entrerios.gov.ar/departamental-federacion/#concursos-nivel-supervisor",
]

# Todas las URLs departamentales
ALL_DEPARTAMENTAL_URLS = [
    "https://cge.entrerios.gov.ar/departamental-diamante/",
    "https://cge.entrerios.gov.ar/departamental-concordia/",
    "https://cge.entrerios.gov.ar/departamental-parana/",
    "https://cge.entrerios.gov.ar/departamental-uruguay/",
    "https://cge.entrerios.gov.ar/departamental-villaguay/",
    "https://cge.entrerios.gov.ar/departamental-colón/",
    "https://cge.entrerios.gov.ar/departamental-federal/",
    "https://cge.entrerios.gov.ar/departamental-concepción-del-uruguay/"
]

# Palabras clave de concursos
CONTEST_KEYWORDS = [
    "concurso", "convocatoria", "llamado", "edicto", "nombramiento", "designación",
    "cátedra", "cargo", "horas", "materia", "asignatura", "suplencia", "interinidad",
    "selección", "postulación", "inscripción", "preinscripción", "presentación"
]

# Niveles educativos
EDUCATION_LEVELS = {
    "secundario": ["secundario", "secundaria"],
    "superior": ["superior", "terciario", "universitario"],
    "supervisor": ["supervisor", "supervisión"],
    "primario": ["primario", "primaria"],
    "inicial": ["inicial", "jardín", "preescolar"],
    "especial": ["especial", "necesidades", "integración"]
}

# Materias comunes
COMMON_SUBJECTS = [
    "Matemática", "Lengua y Literatura", "Historia", "Geografía", "Ciencias Naturales",
    "Biología", "Física", "Química", "Educación Física", "Inglés", "Francés",
    "Italiano", "Portugués", "Música", "Artes Plásticas", "Informática",
    "Filosofía", "Psicología", "Sociología", "Economía", "Contabilidad",
    "Administración", "Derecho", "Trabajo Práctico", "Orientación Educativa"
]

# Tipos de establecimientos
SCHOOL_TYPES = [
    "Escuela Secundaria", "E.E.T.N", "Escuela Primaria", "Instituto Superior",
    "Escuela Técnica", "Centro Educativo", "Colegio", "Liceo"
]

# Ciudades y departamentos de Entre Ríos
LOCATIONS = {
    "Paraná": "Paraná",
    "Concepción del Uruguay": "Uruguay", 
    "Gualeguaychú": "Gualeguaychú",
    "Concordia": "Concordia",
    "Colón": "Colón",
    "Villaguay": "Villaguay",
    "Diamante": "Diamante",
    "Federal": "Federal",
    "La Paz": "La Paz",
    "Nogoyá": "Nogoyá",
    "Uruguay": "Uruguay",
    "Ibicuy": "Ibicuy",
    "Victoria": "Victoria",
    "Hasenkamp": "Paraná",
    "Cerrito": "Gualeguaychú",
    "Maciá": "Gualeguaychú",
    "Basavilbaso": "Gualeguaychú",
    "Crespo": "Paraná",
    "Rosario del Tala": "Tala",
    "Viale": "Paraná",
    "Hernandarias": "Paraná"
}

# Headers para evitar bloqueos
REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
}

# Configuración de timeouts
TIMEOUT_CONFIG = {
    'total': 60,  # Timeout total para solicitudes
    'connect': 10,  # Timeout de conexión
    'sock_read': 30  # Timeout de lectura
}

# Límites de procesamiento
PROCESSING_LIMITS = {
    'max_links_per_page': 20,  # Máximo de enlaces a procesar por página
    'max_concurrent_requests': 10,  # Máximo de solicitudes concurrentes
    'max_contests_per_page': 50,  # Máximo de concursos por página
    'target_contests': 100  # Objetivo de concursos a encontrar
}

# Patrones de URLs a ignorar
IGNORED_PATTERNS = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png', '.zip',
    'mailto:', 'tel:', 'javascript:', '#',
    'wp-content', 'wp-admin', 'feed', 'comments'
]

# Selectores CSS para elementos de concursos
CONTEST_SELECTORS = [
    'article',
    'div.post',
    'div.entry',
    'div.concurso',
    'div.convocatoria',
    'div.llamado',
    '.contest-title',
    '.convocatoria-title',
    '.llamado-title',
    '.post-title',
    '.entry-title'
]
