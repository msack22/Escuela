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
};
