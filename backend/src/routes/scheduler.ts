import type { FastifyPluginAsync } from "fastify";
import { schedulerService } from "../services/scheduler.service.js";

export const schedulerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => {
    const status = schedulerService.getStatus();
    return {
      is_running: status.is_running,
      last_run: status.last_run,
      next_run: status.next_run,
      available_sources: status.available_sources,
      job_count: status.job_count,
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

  app.post<{ Body?: { source?: string; force?: boolean } }>("/run-once", async (req, reply) => {
    const source = req.body?.source ?? null;
    try {
      const prisma = req.server.prisma;
      const { runCgeScraper } = await import("../scrapers/cge-scraper.js");
      schedulerService.setCycleProgress({ running: true, step: "Ejecutando scraping...", source: source ?? "all" });
      const count = await runCgeScraper(prisma);
      schedulerService.setLastRun(new Date().toISOString());
      schedulerService.setCycleProgress({ running: false });
      return { message: "Scraping job started successfully", source, force: req.body?.force };
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
};
