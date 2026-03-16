import type { FastifyPluginAsync } from "fastify";
import { schedulerService } from "../services/scheduler.service.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ ok: true, stack: "nodejs" }));
  app.get("/status", async (req, reply) => {
    let database = "connected";
    try {
      await req.server.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "disconnected";
    }
    const schedulerStatus = schedulerService.getStatus();
    return {
      api_status: "healthy",
      database,
      scheduler: {
        is_running: schedulerStatus.is_running,
        last_run: schedulerStatus.last_run,
        next_run: schedulerStatus.next_run,
        available_sources: schedulerStatus.available_sources,
      },
      stack: "nodejs",
    };
  });
  app.get("/health", async (req, reply) => {
    try {
      await req.server.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "connected" };
    } catch (e) {
      reply.status(503);
      return { status: "error", database: "disconnected" };
    }
  });
};
