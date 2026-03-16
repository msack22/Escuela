import type { FastifyPluginAsync } from "fastify";

function toSchoolDto(s: { id: number; name: string; city: string; department: string; address: string | null; latitude: number | null; longitude: number | null; phone: string | null; email: string | null; created_at?: Date; updated_at?: Date | null }) {
  return {
    id: s.id,
    name: s.name,
    city: s.city,
    department: s.department,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
    phone: s.phone,
    email: s.email,
    ...(s.created_at && { created_at: s.created_at.toISOString() }),
    ...(s.updated_at && { updated_at: s.updated_at.toISOString() }),
  };
}

export const schoolsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { skip?: string; limit?: string } }>("/", async (req) => {
    const skip = Math.max(0, parseInt(req.query.skip ?? "0", 10) || 0);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit ?? "100", 10) || 100));
    const schools = await req.server.prisma.school.findMany({ skip, take: limit, orderBy: { id: "asc" } });
    return schools.map(toSchoolDto);
  });

  app.get<{ Params: { school_id: string } }>("/:school_id", async (req, reply) => {
    const id = parseInt(req.params.school_id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid school id" });
    const school = await req.server.prisma.school.findUnique({ where: { id } });
    if (!school) return reply.status(404).send({ detail: "School not found" });
    return toSchoolDto(school);
  });

  app.get<{ Params: { city: string } }>("/city/:city", async (req) => {
    const schools = await req.server.prisma.school.findMany({
      where: { city: req.params.city },
      orderBy: { name: "asc" },
    });
    return schools.map(toSchoolDto);
  });

  app.get<{ Params: { department: string } }>("/department/:department", async (req) => {
    const schools = await req.server.prisma.school.findMany({
      where: { department: req.params.department },
      orderBy: { name: "asc" },
    });
    return schools.map(toSchoolDto);
  });

  // POST /api/schools/:id/geocode - stub (opcional, requiere Google Maps API)
  app.post<{ Params: { id: string } }>("/:id/geocode", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid id" });
    const school = await req.server.prisma.school.findUnique({ where: { id } });
    if (!school) return reply.status(404).send({ detail: "School not found" });
    return { message: "Geocode not implemented in Node backend", school_id: id };
  });
};
