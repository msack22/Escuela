import type { FastifyPluginAsync } from "fastify";
import { schedulerService } from "../services/scheduler.service.js";
import { runCgeScraper } from "../scrapers/cge-scraper.js";
import { runFacebookCgeScraper } from "../scrapers/facebook-cge-scraper.js";
import { appLogger } from "../lib/logger.js";
import { runScraperBySource } from "./scraping.js";

export const schedulerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => {
    const status = schedulerService.getStatus();
    return {
      is_running: status.is_running,
      last_run: status.last_run,
      next_run: status.next_run,
      available_sources: status.available_sources,
      job_count: status.job_count,
      timezone: status.timezone,
      scheduled_hours: status.scheduled_hours,
      auto_sources: status.auto_sources,
    };
  });

  app.post("/start", async () => {
    if (schedulerService.getStatus().is_running) {
      return { message: "Scheduler is already running", status: "already_running" };
    }
    schedulerService.setRunning(true);
    return { message: "Scheduler started successfully", status: "started" };
  });

  app.post("/stop", async () => {
    if (!schedulerService.getStatus().is_running) {
      return { message: "Scheduler is not running", status: "not_running" };
    }
    schedulerService.setRunning(false);
    return { message: "Scheduler stopped successfully", status: "stopped" };
  });

  app.post<{ Body?: { source?: string; sources?: string[]; force?: boolean } }>("/run-once", async (req, reply) => {
    const body = req.body ?? {};
    const sources: string[] =
      Array.isArray(body.sources) && body.sources.length > 0
        ? body.sources
        : body.source
          ? [body.source]
          : ["all"];

    try {
      const prisma = req.server.prisma;
      schedulerService.setCycleProgress({
        running: true,
        step: "Ejecutando scraping programado...",
        source: sources.join(","),
      });

      let total = 0;
      const results: { source: string; count: number; success: boolean; error?: string }[] = [];

      for (const src of sources) {
        appLogger.info("Scheduler → running scraper from /run-once", { source: src });
        const { count, success, error } = await runScraperBySource(prisma, src);
        total += count;
        results.push({ source: src, count, success, error });
      }

      appLogger.info("Scheduler → run-once finished", { total, results });

      schedulerService.setLastRun(new Date().toISOString());
      schedulerService.setCycleProgress({ running: false });

      return {
        message: "Scraping job started successfully",
        sources,
        force: body.force,
        total_contests: total,
        results,
      };
    } catch (e) {
      schedulerService.setCycleProgress({ running: false });
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  app.get("/jobs", async () => ({ active_jobs: [], count: 0 }));

  app.delete<{ Params: { job_id: string } }>("/jobs/:job_id", async () => ({
    message: "Job cancellation not supported",
  }));

  app.post("/restart", async () => {
    schedulerService.setRunning(false);
    schedulerService.setRunning(true);
    return { message: "Scheduler restarted successfully", status: "restarted" };
  });

  // Configuración sencilla del scheduler automático desde el frontend.
  app.get("/config", async () => {
    return schedulerService.getConfig();
  });

  app.post<{ Body: { scheduled_hours?: number[]; auto_sources?: string[] } }>("/config", async (req) => {
    schedulerService.updateConfig(req.body ?? {});
    return schedulerService.getConfig();
  });

  // Historial de ejecuciones automáticas (solo scheduler en memoria).
  app.get<{ Querystring: { limit?: string } }>("/history", async (req) => {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit ?? "20", 10) || 20));
    return { runs: schedulerService.getHistory(limit) };
  });
};
