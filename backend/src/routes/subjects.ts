import type { FastifyPluginAsync } from "fastify";

export const subjectsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (req) => {
    const list = await req.server.prisma.subject.findMany({ orderBy: { name: "asc" } });
    return list.map((s) => ({ id: s.id, name: s.name, description: s.description }));
  });

  app.get<{ Params: { subject_id: string } }>("/:subject_id", async (req, reply) => {
    const id = parseInt(req.params.subject_id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid subject id" });
    const subject = await req.server.prisma.subject.findUnique({ where: { id } });
    if (!subject) return reply.status(404).send({ detail: "Subject not found" });
    return {
      id: subject.id,
      name: subject.name,
      description: subject.description,
      created_at: subject.created_at?.toISOString() ?? null,
    };
  });
};
