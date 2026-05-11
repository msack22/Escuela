import type { FastifyPluginAsync } from "fastify";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tables", async (req, reply) => {
    try {
      const prisma = req.server.prisma;
      const tables = [
        "schools",
        "subjects",
        "contests",
        "alerts",
        "contest_notification_sent",
        "scraping_logs",
        "users",
      ];
      const result = await Promise.all(
        tables.map(async (table) => {
          try {
            const r = await prisma.$queryRawUnsafe<[{ "COUNT(*)": number }]>(`SELECT COUNT(*) FROM \`${table}\``);
            return { table, count: r[0]["COUNT(*)"] ?? null };
          } catch {
            return { table, count: null };
          }
        })
      );
      return { ok: true, tables: result };
    } catch (e) {
      return reply.status(500).send({ ok: false, error: (e as Error).message, tables: [] });
    }
  });

  // Re-procesa con IA los concursos cuya materia principal es "General"
  app.post("/reprocess-general", async (_req, reply) => {
    try {
      const { reprocessGeneralContests } = await import("../services/reprocess-general.service.js");
      const result = await reprocessGeneralContests();
      return { ok: true, ...result };
    } catch (e) {
      return reply.status(500).send({ ok: false, error: (e as Error).message });
    }
  });

  // Marca manualmente como inactivos los concursos cuya fecha ya pasó
  app.post("/mark-inactive", async (req, reply) => {
    try {
      const prisma = req.server.prisma;
      const result = await prisma.contest.updateMany({
        where: { is_active: true, date: { lt: new Date() } },
        data: { is_active: false },
      });
      return { ok: true, deactivated: result.count };
    } catch (e) {
      return reply.status(500).send({ ok: false, error: (e as Error).message });
    }
  });
};
