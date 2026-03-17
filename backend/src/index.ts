import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { appLogger, emailLogger, getLogsDir } from "./lib/logger.js";
import { healthRoutes } from "./routes/health.js";
import { contestsRoutes } from "./routes/contests.js";
import { alertsRoutes } from "./routes/alerts.js";
import { scrapingRoutes } from "./routes/scraping.js";
import { schoolsRoutes } from "./routes/schools.js";
import { subjectsRoutes } from "./routes/subjects.js";
import { schedulerRoutes } from "./routes/scheduler.js";
import { usersRoutes } from "./routes/users.js";
import { logsRoutes } from "./routes/logs.js";
import { adminRoutes } from "./routes/admin.js";
import { schedulerService } from "./services/scheduler.service.js";

const app = Fastify({ logger: { level: config.LOG_LEVEL } });
app.decorate("prisma", prisma);

await app.register(cors, { origin: true });

await app.register(healthRoutes, { prefix: "/api" });
await app.register(contestsRoutes, { prefix: "/api/contests" });
await app.register(alertsRoutes, { prefix: "/api/alerts" });
await app.register(scrapingRoutes, { prefix: "/api/scraping" });
await app.register(schoolsRoutes, { prefix: "/api/schools" });
await app.register(subjectsRoutes, { prefix: "/api/subjects" });
await app.register(schedulerRoutes, { prefix: "/api/scheduler" });
await app.register(usersRoutes, { prefix: "/api/users" });
await app.register(logsRoutes, { prefix: "/api/logs" });
await app.register(adminRoutes, { prefix: "/api/admin" });

await app.register((await import("./routes/alert-meta.js")).alertMetaRoutes, { prefix: "/api/alert-meta" });

app.addHook("onResponse", async (req, reply) => {
  appLogger.info("Request", { method: req.method, url: req.url, statusCode: reply.statusCode });
});

emailLogger.info("Email config al inicio", {
  sender: config.SENDER_EMAIL ? `${config.SENDER_EMAIL.slice(0, 3)}***` : "(vacío)",
  hasBrevo: !!config.BREVO_API_KEY,
  hasSendGrid: !!config.SENDGRID_API_KEY,
});

async function start() {
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    const msg = `Backend Node.js escuchando en http://${config.HOST}:${config.PORT}. Logs en ${getLogsDir()}`;
    app.log.info(msg);
    appLogger.info(msg);

    // Activar scheduler automático al iniciar el backend
    schedulerService.setRunning(true);
  } catch (err) {
    appLogger.error("Error al iniciar", { error: String(err) });
    app.log.error(err);
    process.exit(1);
  }
}

start();
