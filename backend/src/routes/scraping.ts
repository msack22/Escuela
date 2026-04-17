import type { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { runCgeScraper } from "../scrapers/cge-scraper.js";
import { runFacebookCgeScraper } from "../scrapers/facebook-cge-scraper.js";
import { runCgeApiScraper, CgeApiUnavailableError } from "../scrapers/cge-api-scraper.js";
import { schedulerService } from "../services/scheduler.service.js";
import { sendAutomaticContestNotifications } from "../services/alert-auto.service.js";
import { appLogger } from "../lib/logger.js";

export async function runScraperBySource(
  prisma: PrismaClient,
  source: string,
): Promise<{ count: number; success: boolean; error?: string }> {
  appLogger.info("Scraping → runScraperBySource called", { source });

  // Ejecutar todos los scrapers conocidos
  if (source === "all") {
    let total = 0;

    appLogger.info("Scraping → running CGE API scraper (all)");
    try {
      const apiCount = await runCgeApiScraper(prisma);
      total += apiCount;
      appLogger.info("Scraping → CGE API scraper finished", { apiCount });
    } catch (err) {
      if (err instanceof CgeApiUnavailableError) {
        appLogger.warn("Scraping → CGE API no disponible, usando fallback HTML scraper", { error: err.message });
        const fallbackCount = await runCgeScraper(prisma);
        total += fallbackCount;
        appLogger.info("Scraping → CGE HTML fallback finished", { fallbackCount });
        const fbCount = await runFacebookCgeScraper(prisma);
        total += fbCount;
        appLogger.info("Scraping → Facebook fallback finished", { fbCount });
      } else {
        throw err;
      }
    }

    appLogger.info("Scraping → all scrapers finished", { total });
    return { count: total, success: true };
  }

  if (source === "cge_api") {
    try {
      const count = await runCgeApiScraper(prisma);
      return { count, success: true };
    } catch (err) {
      if (err instanceof CgeApiUnavailableError) {
        appLogger.warn("Scraping → CGE API no disponible, usando fallback HTML scraper", { error: err.message });
        const fallbackCount = await runCgeScraper(prisma);
        const fbCount = await runFacebookCgeScraper(prisma);
        return { count: fallbackCount + fbCount, success: true };
      }
      throw err;
    }
  }

  // Scrapers legacy — mantenidos como backup
  if (source === "cge_simple" || source === "cge_enterios_completo") {
    const count = await runCgeScraper(prisma);
    return { count, success: true };
  }
  if (source === "facebook_cge") {
    const count = await runFacebookCgeScraper(prisma);
    return { count, success: true };
  }
  if (source === "datos_abiertos_argentina" || source === "puntos_digitales") {
    return { count: 0, success: true };
  }
  return { count: 0, success: false, error: "Unknown source" };
}

export const scrapingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => {
    const st = schedulerService.getStatus();
    return { ...st, status: st.is_running ? "running" : "idle" };
  });

  app.get("/progress", async () => {
    const cycle = schedulerService.getCycleProgress();
    if (cycle.running) {
      return { running: true, source: cycle.source ?? "scheduler", step: cycle.step ?? "Scraping...", percentage: cycle.percentage, current: cycle.current, total: cycle.total };
    }
    return { running: false, step: "", percentage: null, source: null };
  });

  // Endpoint SSE compatible con el backend Python: /api/scraping/progress/stream
  app.get("/progress/stream", async (req, reply) => {
    // Headers SSE
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const send = () => {
      const cycle = schedulerService.getCycleProgress();
      const payload = cycle.running
        ? {
            running: true,
            source: cycle.source ?? "scheduler",
            step: cycle.step ?? "Scraping...",
            percentage: cycle.percentage,
            current: cycle.current,
            total: cycle.total,
          }
        : {
            running: false,
            step: "",
            percentage: null,
            source: null,
          };
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // Enviar inmediatamente un estado inicial
    send();
    const interval = setInterval(send, 2000);

    req.raw.on("close", () => {
      clearInterval(interval);
      reply.raw.end();
    });
  });

  app.get<{ Querystring: { limit?: string } }>("/logs", async (req) => {
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit ?? "50", 10) || 50));
    const logs = await req.server.prisma.scrapingLog.findMany({ take: limit, orderBy: { started_at: "desc" } });
    return { logs };
  });

  app.post("/start", async () => {
    if (schedulerService.getStatus().is_running) return { message: "Scheduler is already running" };
    schedulerService.setRunning(true);
    return { message: "Scheduler started successfully" };
  });

  app.post("/stop", async () => {
    schedulerService.setRunning(false);
    return { message: "Scheduler stopped successfully" };
  });

  app.post<{ Body?: { source?: string; sources?: string[]; send_notifications?: boolean } }>("/run", async (req, reply) => {
    const body = req.body ?? {};
    const sources: string[] =
      Array.isArray(body.sources) && body.sources.length > 0
        ? body.sources
        : body.source
          ? [body.source]
          : ["all"];
    const sendNotifications = body.send_notifications !== false;

    const start = Date.now();
    schedulerService.setCycleProgress({
      running: true,
      step: `Scraping ${sources.join(", ")}...`,
      source: sources.join(","),
    });

    try {
      const results: { source: string; count: number; success: boolean; error?: string }[] = [];

      for (const src of sources) {
        const { count, success, error } = await runScraperBySource(req.server.prisma, src);
        const elapsed = (Date.now() - start) / 1000;

        results.push({ source: src, count, success, error });

        await req.server.prisma.scrapingLog.create({
          data: {
            source_name: src,
            status: success ? "success" : "error",
            contests_found: count,
            contests_processed: count,
            error_message: error ?? null,
            execution_time_seconds: elapsed,
            finished_at: new Date(),
          },
        });
      }

      const totalCount = results.reduce((acc, r) => acc + r.count, 0);
      const anyError = results.some((r) => !r.success);
      const elapsedTotal = (Date.now() - start) / 1000;
      const notifSummary = sendNotifications
        ? await sendAutomaticContestNotifications(req.server.prisma, start)
        : { alerts_processed: 0, notifications_created: 0, skipped: true };

      schedulerService.setLastRun(new Date().toISOString());
      schedulerService.setCycleProgress({ running: false });

      return {
        success: !anyError,
        contests_found: totalCount,
        execution_time_seconds: elapsedTotal,
        results,
        notifications: notifSummary,
        send_notifications: sendNotifications,
        message: !anyError
          ? `Scraping ${sources.join(", ")} finalizado`
          : "Scraping finalizado con errores en alguna fuente",
      };
    } catch (e) {
      const err = e as Error;
      const elapsedSeconds = (Date.now() - start) / 1000;
      schedulerService.setCycleProgress({ running: false });

      appLogger.error("Scraping /run failed", {
        sources,
        error_name: err.name,
        error_message: err.message,
        error_stack: err.stack ?? null,
        execution_time_seconds: elapsedSeconds,
      });

      await req.server.prisma.scrapingLog.create({
        data: {
          source_name: sources.join(","),
          status: "error",
          contests_found: 0,
          contests_processed: 0,
          error_message: err.message,
          execution_time_seconds: elapsedSeconds,
          finished_at: new Date(),
        },
      });

      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  app.post("/run-datos-abiertos", async (req, reply) => {
    const start = Date.now();
    try {
      const { count } = await runScraperBySource(req.server.prisma, "datos_abiertos_argentina");
      return { message: "Scraping de Datos Abiertos Argentina finalizado", total_datasets: count, scraped_at: new Date().toISOString(), source: "datos_abiertos_argentina" };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  app.post("/run-puntos-digitales", async (req, reply) => {
    try {
      await runScraperBySource(req.server.prisma, "puntos_digitales");
      return { message: "Scraping de Puntos Digitales finalizado", total_capacitaciones: 0, scraped_at: new Date().toISOString(), source: "puntos_digitales" };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  app.post("/run-cge-simple", async (req, reply) => {
    try {
      const count = await runCgeApiScraper(req.server.prisma);
      return { message: "Scraping CGE Entre Ríos finalizado", total_contests: count, scraped_at: new Date().toISOString(), source: "cge_api", contests: [] };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  app.post("/run-cge-completo", async (req, reply) => {
    try {
      const count = await runCgeApiScraper(req.server.prisma);
      return { message: "Scraping CGE Entre Ríos finalizado", total_contests: count, scraped_at: new Date().toISOString(), source: "cge_api" };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });
};
