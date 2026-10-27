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

  // PATCH /api/schools/:id - actualizar datos de una escuela
  app.patch<{
    Params: { id: string };
    Body: { name?: string; city?: string; department?: string; address?: string; phone?: string; email?: string };
  }>("/:id", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid id" });
    const school = await req.server.prisma.school.findUnique({ where: { id } });
    if (!school) return reply.status(404).send({ detail: "School not found" });
    const updated = await req.server.prisma.school.update({ where: { id }, data: req.body });
    return toSchoolDto(updated);
  });

  // GET /api/schools/padron - listar el padrón oficial con búsqueda y paginación
  app.get<{ Querystring: { skip?: string; limit?: string; q?: string; departamento?: string } }>(
    "/padron",
    async (req) => {
      const skip  = Math.max(0, parseInt(req.query.skip  ?? "0",   10) || 0);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit ?? "50", 10) || 50));
      const q     = req.query.q?.trim();
      const dept  = req.query.departamento?.trim();

      const where: Record<string, unknown> = {};
      if (dept) where.departamento = { contains: dept };
      if (q) {
        where.OR = [
          { nombre:       { contains: q } },
          { localidad:    { contains: q } },
          { departamento: { contains: q } },
          { cueanexo:     { contains: q } },
        ];
      }

      const [rows, total] = await Promise.all([
        req.server.prisma.padronEscuela.findMany({ where, skip, take: limit, orderBy: { cueanexo: "asc" } }),
        req.server.prisma.padronEscuela.count({ where }),
      ]);

      return { total, skip, limit, rows };
    },
  );

  // GET /api/schools/padron/:cueanexo - detalle de una escuela del padrón
  app.get<{ Params: { cueanexo: string } }>("/padron/:cueanexo", async (req, reply) => {
    const row = await req.server.prisma.padronEscuela.findUnique({ where: { cueanexo: req.params.cueanexo } });
    if (!row) return reply.status(404).send({ detail: "CUE no encontrado" });
    return row;
  });

  // PATCH /api/schools/padron/:cueanexo - actualizar datos del padrón
  app.patch<{
    Params: { cueanexo: string };
    Body: { nombre?: string; departamento?: string; localidad?: string; sector?: string; ambito?: string; domicilio?: string; cp?: string; telefono?: string };
  }>("/padron/:cueanexo", async (req, reply) => {
    const existing = await req.server.prisma.padronEscuela.findUnique({ where: { cueanexo: req.params.cueanexo } });
    if (!existing) return reply.status(404).send({ detail: "CUE no encontrado" });
    const updated = await req.server.prisma.padronEscuela.update({
      where: { cueanexo: req.params.cueanexo },
      data: req.body,
    });
    return updated;
  });
};
