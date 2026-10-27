import type { FastifyPluginAsync } from "fastify";

export const subjectsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (req) => {
    const list = await req.server.prisma.subject.findMany({ orderBy: { name: "asc" } });
    return list.map((s) => ({
      id: s.id,
      name: s.name,
      normalized_name: s.normalized_name ?? s.name,
      description: s.description,
    }));
  });

  /** Estadísticas de uso: conteo de concursos e ítems por materia. */
  app.get("/stats", async () => {
    const subjects = await app.prisma.subject.findMany({
      select: {
        id: true,
        name: true,
        normalized_name: true,
        _count: { select: { contests: true, contestItems: true } },
      },
      orderBy: [{ normalized_name: "asc" }, { name: "asc" }],
    });
    return subjects.map((s) => ({
      id: s.id,
      name: s.name,
      normalized_name: s.normalized_name ?? s.name,
      contest_count: s._count.contests,
      item_count: s._count.contestItems,
    }));
  });

  /** Concursos asociados a una materia (por subject_id directo o por contest_items). */
  app.get<{ Params: { subject_id: string } }>("/:subject_id/contests", async (req, reply) => {
    const id = parseInt(req.params.subject_id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid subject id" });

    // Concursos donde esta materia aparece como ítem (más completo)
    const itemRows = await app.prisma.contestItem.findMany({
      where: { subject_id: id },
      select: {
        hours_to_cover: true,
        grade: true,
        caracter: true,
        contest: {
          select: {
            id: true,
            title: true,
            date: true,
            level: true,
            source_url: true,
            school: { select: { name: true, city: true, department: true } },
          },
        },
      },
      orderBy: { contest: { date: "desc" } },
      take: 200,
    });

    // Concursos donde esta materia es el subject principal pero sin ítems
    const directRows = await app.prisma.contest.findMany({
      where: {
        subject_id: id,
        items: { none: {} },
      },
      select: {
        id: true,
        title: true,
        date: true,
        level: true,
        source_url: true,
        school: { select: { name: true, city: true, department: true } },
      },
      orderBy: { date: "desc" },
      take: 200,
    });

    // Unir y desduplicar
    const seen = new Set<number>();
    const contests: {
      id: number; title: string; date: string | null; level: string | null;
      source_url: string; school: { name: string; city: string; department: string } | null;
      hours_to_cover: number | null; grade: string | null; caracter: string | null;
    }[] = [];

    for (const row of itemRows) {
      if (seen.has(row.contest.id)) continue;
      seen.add(row.contest.id);
      contests.push({
        ...row.contest,
        date: row.contest.date?.toISOString() ?? null,
        hours_to_cover: row.hours_to_cover,
        grade: row.grade,
        caracter: row.caracter,
      });
    }
    for (const c of directRows) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      contests.push({ ...c, date: c.date?.toISOString() ?? null, hours_to_cover: null, grade: null, caracter: null });
    }

    return contests;
  });

  app.get<{ Params: { subject_id: string } }>("/:subject_id", async (req, reply) => {
    const id = parseInt(req.params.subject_id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid subject id" });
    const subject = await req.server.prisma.subject.findUnique({ where: { id } });
    if (!subject) return reply.status(404).send({ detail: "Subject not found" });
    return {
      id: subject.id,
      name: subject.name,
      normalized_name: subject.normalized_name ?? subject.name,
      description: subject.description,
      created_at: subject.created_at?.toISOString() ?? null,
    };
  });
};
