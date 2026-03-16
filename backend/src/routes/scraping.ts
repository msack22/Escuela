import type { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { runCgeScraper } from "../scrapers/cge-scraper.js";
import { schedulerService } from "../services/scheduler.service.js";

async function runScraperBySource(prisma: PrismaClient, source: string): Promise<{ count: number; success: boolean; error?: string }> {
  if (source === "cge_simple" || source === "cge_enterios_completo") {
    const count = await runCgeScraper(prisma);
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

  app.post<{ Body?: { source?: string } }>("/run", async (req, reply) => {
    const source = req.body?.source ?? "cge_simple";
    const start = Date.now();
    schedulerService.setCycleProgress({ running: true, step: `Scraping ${source}...`, source });
    try {
      const { count, success, error } = await runScraperBySource(req.server.prisma, source);
      const elapsed = (Date.now() - start) / 1000;
      schedulerService.setLastRun(new Date().toISOString());
      schedulerService.setCycleProgress({ running: false });
      await req.server.prisma.scrapingLog.create({
        data: {
          source_name: source,
          status: success ? "success" : "error",
          contests_found: count,
          contests_processed: count,
          error_message: error ?? null,
          execution_time_seconds: elapsed,
          finished_at: new Date(),
        },
      });
      return { success, contests_found: count, execution_time_seconds: elapsed, message: success ? `Scraping ${source} finalizado` : error };
    } catch (e) {
      const err = e as Error;
      schedulerService.setCycleProgress({ running: false });
      await req.server.prisma.scrapingLog.create({
        data: {
          source_name: source,
          status: "error",
          contests_found: 0,
          contests_processed: 0,
          error_message: err.message,
          execution_time_seconds: (Date.now() - start) / 1000,
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
    const start = Date.now();
    try {
      const count = await runCgeScraper(req.server.prisma);
      return { message: "Scraping simplificado de CGE Entre Ríos finalizado", total_contests: count, scraped_at: new Date().toISOString(), source: "cge_simple", contests: [] };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  app.post("/run-cge-completo", async (req, reply) => {
    try {
      const count = await runCgeScraper(req.server.prisma);
      return { message: "Scraping completo de CGE Entre Ríos finalizado", total_contests: count, scraped_at: new Date().toISOString(), source: "cge_enterios_completo" };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });
};
