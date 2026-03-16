import type { FastifyPluginAsync } from "fastify";
import fs from "fs";
import { getFrontendLogPath } from "../lib/logger.js";

export const logsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: {
      logs?: Array<{ id?: number; level?: string; message?: string; metadata?: Record<string, unknown>; timestamp?: string; url?: string; userAgent?: string }>;
      clientInfo?: Record<string, unknown>;
    };
  }>("/frontend", async (req, reply) => {
    try {
      if (!req.body.logs?.length) return { success: true, message: "No logs to save" };
      const LOG_FILE = getFrontendLogPath();
      const line = req.body.logs
        .map(
          (l) =>
            `${l.timestamp ?? new Date().toISOString()} [${l.level ?? "INFO"}] ${l.message ?? ""} ${l.metadata ? JSON.stringify(l.metadata) : ""}`
        )
        .join("\n");
      fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
      return { success: true };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  app.get("/frontend/status", async () => {
    const LOG_FILE = getFrontendLogPath();
    return { enabled: true, log_file: LOG_FILE, exists: fs.existsSync(LOG_FILE) };
  });

  app.get("/frontend/recent", async (req, reply) => {
    const LOG_FILE = getFrontendLogPath();
    if (!fs.existsSync(LOG_FILE)) return { lines: [] };
    try {
      const content = fs.readFileSync(LOG_FILE, "utf-8");
      const lines = content.trim().split("\n").slice(-100);
      return { lines };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  app.delete("/frontend", async (req, reply) => {
    try {
      const LOG_FILE = getFrontendLogPath();
      if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
      return { success: true };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });
};
