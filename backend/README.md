# Backend Node.js – Escuela (migración desde Python)

Backend en **Node.js + TypeScript** con **Fastify**, **Prisma** y **Playwright** para scraping. Pensado para reemplazar o coexistir con el backend Python, usando la misma base de datos MySQL.

## Stack

| Uso | Tecnología |
|-----|------------|
| API | **Fastify** (rápido, bajo consumo) |
| ORM / DB | **Prisma** (MySQL, mismo esquema que Python) |
| Scraping | **axios** (descargar páginas) + **cheerio** (parsear HTML) + **Playwright** / **Puppeteer** (Chrome cuando hace falta JS) |
| Email | Brevo / SendGrid (mismo .env que Python) |
| Validación | **Zod** |
| Cron | **node-cron** (opcional) |

### Scraping optimizado

- **axios** → descarga HTTP rápida (páginas estáticas).
- **cheerio** → parseo de HTML (selectores tipo jQuery).
- **Playwright** o **Puppeteer** → cuando el sitio requiere JavaScript o bloquea requests simples.

Por defecto se intenta primero **axios + cheerio**; si falla o el contenido es muy corto, se usa el navegador (`SCRAPING_ENGINE=playwright` o `puppeteer`). Variables: `SCRAPING_PREFER_HTTP`, `SCRAPING_ENGINE`, `SCRAPING_TIMEOUT_MS`.

## Requisitos

- Node.js >= 18
- MySQL (misma base que el backend Python)

## Instalación

```bash
cd backend
npm install
cp .env.example .env
# Editar .env con DATABASE_URL, SENDER_EMAIL, BREVO_API_KEY o SENDGRID_API_KEY
npx prisma generate
npx playwright install chromium
```

## Uso

```bash
# Desarrollo (recarga al cambiar código)
npm run dev

# Producción
npm run build
npm start
```

Por defecto escucha en **http://0.0.0.0:8001** (cambiable con `PORT` en `.env`). Para que el frontend use este backend en lugar del Python, cambia la base URL al puerto 8001 o usa un proxy.

## Endpoints implementados (paridad con backend Python)

- **Raíz y estado:** `GET /api/`, `GET /api/status`, `GET /api/health`
- **Contests:** `GET /api/contests` (filtros), `GET /api/contests/:id`, `DELETE /api/contests/clear`, `GET /api/contests/statistics/summary`, `GET /api/contests/filters/subjects|cities|levels|shifts|contract-types|departments|sources`
- **Schools:** `GET /api/schools`, `GET /api/schools/:id`, `GET /api/schools/city/:city`, `GET /api/schools/department/:department`, `POST /api/schools/:id/geocode` (stub)
- **Subjects:** `GET /api/subjects`, `GET /api/subjects/:id`
- **Alerts:** CRUD, `GET /api/alerts/notification-channels`, `POST /api/alerts/test-notification`, `POST /api/alerts/:id/test-contest-notifications`, `POST /api/alerts/send-multi` (stub)
- **Alert-meta:** `GET /api/alert-meta/notification-info`, `POST /api/alert-meta/test-contest-notifications`
- **Scraping:** `GET /api/scraping/status`, `GET /api/scraping/progress`, `GET /api/scraping/logs`, `POST /api/scraping/run`, `POST /api/scraping/run-cge-simple`, `POST /api/scraping/run-cge-completo`, `POST /api/scraping/run-datos-abiertos`, `POST /api/scraping/run-puntos-digitales`, `POST /api/scraping/start`, `POST /api/scraping/stop`
- **Scheduler:** `GET /api/scheduler/status`, `POST /api/scheduler/start`, `POST /api/scheduler/stop`, `POST /api/scheduler/run-once`, `GET /api/scheduler/jobs`, `DELETE /api/scheduler/jobs/:id`, `POST /api/scheduler/restart`
- **Users:** CRUD, `GET /api/users/:id/alerts`, `GET /api/users/:id/contest-notifications`
- **Logs:** `POST /api/logs/frontend`, `GET /api/logs/frontend/status`, `GET /api/logs/frontend/recent`, `DELETE /api/logs/frontend`
- **Admin:** `GET /api/admin/tables`

## Scraping con Playwright

Playwright permite:

- Ejecutar JavaScript del sitio (SPAs, contenido cargado por AJAX).
- Manejar cookies, sesiones y navegación real.
- Evitar bloqueos básicos (headless con parámetros realistas).

El scraper de ejemplo en `src/scrapers/cge-scraper.ts` abre la página de CGE Entre Ríos, obtiene el HTML y extrae enlaces con Cheerio. Puedes añadir más fuentes en `src/scrapers/` y registrarlas en `src/routes/scraping.ts`.

## Migración desde Python

- **Base de datos**: Mismo MySQL; el schema de Prisma replica las tablas principales (schools, subjects, contests, alerts, contest_notification_sent, scraping_logs). Podés usar ambos backends contra la misma DB durante la transición.
- **Variables de entorno**: Mismas que el backend Python (`DATABASE_URL`, `SENDER_EMAIL`, `BREVO_API_KEY`, `SENDGRID_API_KEY`). Copiá el `.env` del backend Python a `backend/.env`.
- **Pendiente de migrar**: módulos **capacitaciones**, **diplomas**, **resoluciones** y WhatsApp (pywhatkit). Scrapers adicionales (educacion_gob, etc.) se pueden añadir en `src/scrapers/`.

## Estructura

```
backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config.ts
│   ├── db.ts
│   ├── index.ts
│   ├── types/
│   ├── routes/          # health, contests, alerts, alert-meta, scraping, schools, subjects, scheduler, users, logs, admin
│   ├── services/        # contest-search, alert-test, scheduler
│   ├── infrastructure/  # email-notifier
│   └── scrapers/        # cge-scraper (Playwright + Cheerio)
├── package.json
├── tsconfig.json
└── README.md
```
