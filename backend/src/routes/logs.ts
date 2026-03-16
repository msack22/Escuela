import type { FastifyPluginAsync } from "fastify";
import fs from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs", "frontend");
const LOG_FILE = path.join(LOG_DIR, "frontend.log");

export const logsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: {
      logs?: Array<{ id?: number; level?: string; message?: string; metadata?: Record<string, unknown>; timestamp?: string; url?: string; userAgent?: string }>;
      clientInfo?: Record<string, unknown>;
    };
  }>("/frontend", async (req, reply) => {
    try {
      if (!req.body.logs?.length) return { success: true, message: "No logs to save" };
      if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
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

  app.get("/frontend/status", async () => ({
    enabled: true,
    log_file: LOG_FILE,
    exists: fs.existsSync(LOG_FILE),
  }));

  app.get("/frontend/recent", async (req, reply) => {
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
      if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
      return { success: true };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });
};
