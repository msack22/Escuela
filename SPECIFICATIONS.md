# 📋 Especificaciones Técnicas del Sistema de Concursos Educativos

## 🎯 **Objetivo del Documento**
Este documento describe las especificaciones técnicas y configuraciones necesarias para el correcto funcionamiento del Sistema de Concursos Educativos, asegurando que todos los componentes operen de manera integrada y eficiente.

## 📋 **Arquitectura General**
- **Backend**: Python 3.11+ con FastAPI
- **Frontend**: React 18+ con TypeScript
- **Base de Datos**: MySQL 8.0+
- **Cache**: Redis 6.0+
- **Message Queue**: Celery con Redis
- **Containerización**: Docker Compose

## 🔧 **Requisitos del Sistema**

### **1. Infraestructura Requerida**
- **Python**: 3.11 o superior
- **Node.js**: 18.0 o superior
- **MySQL**: 8.0 o superior
- **Redis**: 6.0 o superior
- **Docker**: 20.10+ o Docker Compose 2.0+

### **2. Variables de Entorno**
#### **Backend (.env)**
```bash
# Base de Datos
DATABASE_URL=mysql+pymysql://root:tu_password@localhost/concursos_db

# Redis
REDIS_URL=redis://localhost:6379

# APIs Externas
GOOGLE_MAPS_API_KEY=tu_google_maps_api_key_aqui
TWILIO_ACCOUNT_SID=tu_twilio_account_sid_aqui
TWILIO_AUTH_TOKEN=tu_twilio_auth_token_aqui
TWILIO_WHATSAPP_NUMBER=tu_numero_twilio_aqui

# Seguridad
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Configuración de Scraping
SCRAPING_INTERVAL_HOURS=2
MAX_CONCURRENT_SCRAPERS=5

# Ubicación del Usuario
USER_LATITUDE=-34.6037
USER_LONGITUDE=-58.3816
```

#### **Frontend (.env)**
```bash
# API del Backend
REACT_APP_API_URL=http://localhost:8000
```

### **3. Dependencias Python**
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
alembic==1.12.1
pydantic==2.5.0
python-multipart==0.0.6
pymysql==1.1.0
cryptography==41.0.7
aiohttp==3.9.1
beautifulsoup4==4.12.2
python-dotenv==1.0.0
redis==5.0.1
celery==5.3.4
twilio==8.10.0
google-api-python-client==2.100.0
google-auth-httplib2==0.1.1
google-auth-oauthlib==1.1.0
requests==2.31.0
selenium==4.15.2
lxml==4.9.3
python-dateutil==2.8.2
pytz==2023.3
pandas==2.1.0
openpy==3.1.2
```

### **4. Dependencias Node.js**
```json
{
  "name": "concursos-educativos-frontend",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "@reduxjs/toolkit": "^1.9.0",
    "react-redux": "^8.0.0",
    "@tanstack/react-query": "^4.0.0",
    "@mui/material": "^5.11.0",
    "@mui/icons-material": "^5.11.0",
    "axios": "^1.6.0",
    "date-fns": "^2.30.0",
    "typescript": "^4.9.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  }
}
```

## 🗄️ **Estructura del Proyecto**

### **Backend**
```
backend/
├── app/
│   ├── api/routes/
│   │   ├── contests.py          # Gestión de concursos
│   │   ├── alerts.py            # Alertas y notificaciones
│   │   ├── scraping.py          # Control de scraping
│   │   ├── schools.py           # Gestión de escuelas
│   │   ├── subjects.py          # Materias disponibles
│   │   └── calendar.py          # Gestión de calendarios
│   ├── core/
│   │   ├── config.py            # Configuración y variables de entorno
│   │   └── database.py         # Conexión a base de datos
│   ├── domain/
│   │   ├── models/
│   │   │   └── models.py        # Modelos SQLAlchemy
│   │   └── repositories/
│   │       └── repositories.py   # Patrón Repository
│   ├── infrastructure/
│   │   ├── scrapers/
│   │   │   ├── base_scraper.py
│   │   │   ├── educacion_gob_scraper.py
│   │   │   ├── enterios_scraper.py
│   │   │   ├── facebook_scraper.py
│   │   │   └── scraper_factory.py
│   │   ├── notifications/
│   │   │   ├── base_notifier.py
│   │   │   └── whatsapp_notifier.py
│   │   ├── external_apis/
│   │   │   └── google_maps_service.py
│   │   └── calendar_manager.py   # Gestión de calendarios
│   └── application/services/
│       ├── contest_processing_service.py
│       ├── contest_search_service.py
│       ├── alert_service.py
│       └── scheduler_service.py
├── alembic/                      # Migraciones de base de datos
├── main.py                      # Aplicación FastAPI principal
├── requirements.txt               # Dependencias Python
└── .env.example                 # Plantilla de variables de entorno
```

### **Frontend**
```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   └── Navbar/
│   │       └── Navbar.tsx
│   ├── pages/
│   │   ├── Dashboard/
│   │   │   └── Dashboard.tsx
│   │   ├── ContestList/
│   │   │   └── ContestList.tsx
│   │   ├── AlertManagement/
│   │   │   └── AlertManagement.tsx
│   │   └── ScrapingStatus/
│   │       └── ScrapingStatus.tsx
│   ├── services/
│   │   └── api.ts
│   ├── store/
│   │   └── slices/
│   │       ├── contestsSlice.ts
│   │       ├── alertsSlice.ts
│   │       └── scrapingSlice.ts
│   ├── store.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── index.css
├── package.json
└── .env.example
```

## 🚀 **Instalación y Despliegue**

### **1. Configuración Inicial**
```bash
# Clonar repositorio
git clone <repositorio>

# Configurar Backend
cd backend
cp .env.example .env
# Editar .env con tus credenciales

# Instalar dependencias
pip install -r requirements.txt

# Crear base de datos
alembic upgrade head
alembic revision --autogenerate -m "Initial migration"

# Iniciar servidor
uvicorn main:reload
```

### **2. Configuración Frontend**
```bash
# Configurar Frontend
cd frontend
cp .env.example .env

# Instalar dependencias
npm install

# Iniciar servidor
npm start
```

### **3. Docker Compose (Producción)**
```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: concursos_mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: tu_password
      MYSQL_DATABASE: concursos_db
      MYSQL_USER: root
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    container_name: concursos_redis
    restart: unless-stopped
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    container_name: concursos_backend
    restart: unless-stopped
    environment:
      - DATABASE_URL=mysql+pymysql://root:tu_password@mysql/concursos_db
      - REDIS_URL=redis://redis:6379
    ports:
      - "8000:8000"
    depends_on:
      - mysql
      - redis
    volumes:
      - ./backend:/app

  frontend:
    build: ./frontend
    container_name: concursos_frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://backend:8000
    depends_on:
      - backend

volumes:
  mysql_data:
  redis_data:
```

## 📊 **API Endpoints Disponibles**

### **Concursos**
- `GET /api/contests/` - Listar concursos con filtros
- `GET /api/contests/{id}` - Obtener concurso específico
- `GET /api/contests/statistics/summary` - Estadísticas
- `GET /api/contests/filters/*` - Opciones de filtros

### **Alertas**
- `GET /api/alerts/` - Listar alertas
- `POST /api/alerts/` - Crear alerta
- `PUT /api/alerts/{id}` - Actualizar alerta
- `DELETE /api/alerts/{id}` - Eliminar alerta
- `POST /api/alerts/test-notification` - Probar notificación

### **Scraping**
- `GET /api/scraping/status` - Estado del scheduler
- `POST /api/scraping/run` - Ejecutar scraping manual
- `GET /api/scraping/logs` - Ver logs de scraping

### **Escuelas**
- `GET /api/schools/` - Listar escuelas
- `GET /api/schools/{id}` - Obtener escuela específica
- `POST /api/schools/{id}/geocode` - Geocodificar escuela

### **Materias**
- `GET /api/subjects/` - Listar materias disponibles

### **Calendarios**
- `POST /api/calendar/analyze-conflicts` - Analizar conflictos
- `POST /api/calendar/export-schedule` - Exportar horario a CSV
- `POST /api/calendar/import-schedule` - Importar horario desde CSV
- `GET /api/calendar/conflict-report` - Ejemplo de reporte
- `GET /api/calendar/suggestions` - Sugerencias de optimización

## 🔐 **Seguridad**

### **Autenticación**
- Tokens JWT con expiración configurable
- CORS configurado para desarrollo
- Variables de entorno sensibles en .env
- Contraseñas seguras (mínimo 8 caracteres)

### **Base de Datos**
- MySQL con conexión SSL en producción
- Migraciones con Alembic
- Índices optimizados para búsquedas
- Pool de conexiones configurado

## 📱 **Características Implementadas**

### ✅ **Scraping Multi-fuente**
- **Educación Gob**: Concursos nacionales oficiales
- **Consejo Entre Ríos**: Concursos provinciales con detalles completos
- **Facebook**: Búsqueda en redes sociales y páginas públicas

### ✅ **Gestión de Calendarios**
- **Análisis de conflictos**: Detección automática de solapamientos
- **Importación/Exportación**: Soporte CSV para horarios personales
- **Sugerencias inteligentes**: Recomendaciones de optimización

### ✅ **Notificaciones WhatsApp**
- **Información completa**: Nivel, turno, horarios, horas, contrato
- **Mapas integrados**: Enlace a Google Maps con ubicación
- **Personalización**: Preferencias por materia y distancia

### ✅ **Frontend Moderno**
- **React 18**: Últimas características y hooks
- **Material-UI v5**: Interface moderna y accesible
- **Redux Toolkit**: Gestión de estado centralizada
- **TypeScript**: Tipado estático y seguro
- **Responsive design**: Adaptable a móviles

## 🎯 **Requisitos de Rendimiento**

### **Backend**
- **Python 3.11+**: Para características modernas
- **Memoria RAM**: Mínimo 2GB recomendado
- **CPU**: 2+ cores recomendado
- **Almacenamiento**: 20GB+ para MySQL y logs

### **Frontend**
- **Navegador**: Chrome 90+, Firefox 88+, Safari 14+
- **Memoria RAM**: Mínimo 4GB recomendado
- **CPU**: Procesador moderno recomendado

## 📋 **Monitorización y Logging**

### **Backend**
- Logs estructurados con niveles (INFO, WARNING, ERROR)
- Métricas de rendimiento en endpoints
- Health checks para monitoreo
- Integración con sistemas de monitoreo externos

### **Frontend**
- Error boundaries en React
- Console limpia y organizada
- Build optimizado para producción
- Service Workers para tareas pesadas

## 🔧 **Mantenimiento**

### **Actualizaciones**
- **Backend**: `pip install -r requirements.txt --upgrade`
- **Frontend**: `npm update` y `npm audit fix`
- **Base de datos**: `alembic upgrade head` y `alembic revision --autogenerate`

### **Backups**
- **Base de datos**: Exportes diarios de MySQL
- **Código**: Versionado con Git tags
- **Configuración**: Archivos .env versionados

## 🎓 **Flujo de Usuario Típico**

1. **Registro**: Usuario crea cuenta y configura alertas
2. **Búsqueda**: Filtra concursos por nivel, materia, ubicación
3. **Análisis**: Sistema detecta conflictos con su horario actual
4. **Postulación**: Aplica a concursos compatibles
5. **Notificación**: Recibe alertas WhatsApp con detalles completos
6. **Gestión**: Exporta/importa horarios para optimizar postulaciones

## 📞 **Soporte y Documentación**

### **Documentación API**
- Swagger UI: `http://localhost:8000/docs`
- OpenAPI Specification: `http://localhost:8000/openapi.json`

### **Logs y Debugging**
- Nivel LOG: INFO para desarrollo, ERROR para producción
- Archivos de log rotativos (máximo 100MB)
- Modo debug configurable por variable de entorno

---

**Nota**: Este documento debe ser mantenido actualizado según evolucione del sistema. Última actualización: Versión 2.0 - Marzo 2026
