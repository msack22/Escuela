import type { FastifyPluginAsync } from "fastify";
import { contestSearchService } from "../services/contest-search.service.js";

const LEVELS = ["Inicial", "Primaria", "Secundaria", "Jardín"];
const SHIFTS = ["Mañana", "Tarde", "Jornada Completa", "Vespertina", "Nocturna"];
const CONTRACT_TYPES = ["Titular", "Suplente", "Interino", "Contratado", "Temporario", "Reemplazo", "Carga Horaria"];

export const contestsRoutes: FastifyPluginAsync = async (app) => {
  // DELETE /api/contests/clear
  app.delete("/clear", async (req, reply) => {
    await req.server.prisma.contest.deleteMany({});
    return { message: "All contests cleared successfully" };
  });

  // GET /api/contests/statistics/summary
  app.get("/statistics/summary", async () => {
    return contestSearchService.getStatistics();
  });

  app.get("/filters/subjects", async () => contestSearchService.getAllSubjects());
  app.get("/filters/cities", async () => ({ cities: await contestSearchService.getAllCities() }));
  app.get("/filters/levels", async () => ({ levels: LEVELS }));
  app.get("/filters/shifts", async () => ({ shifts: SHIFTS }));
  app.get("/filters/contract-types", async () => ({ contract_types: CONTRACT_TYPES }));
  app.get("/filters/departments", async () => ({ departments: await contestSearchService.getAllDepartments() }));
  app.get("/filters/sources", async () => ({ sources: await contestSearchService.getAllSources() }));

  // GET /api/contests - búsqueda con filtros
  app.get<{
    Querystring: {
      skip?: string;
      limit?: string;
      date_from?: string;
      date_to?: string;
      departments?: string;
      subject_id?: string;
      subject_ids?: string;
      city?: string;
      cities?: string;
      department?: string;
      level?: string;
      shift?: string;
      contract_type?: string;
      source_name?: string;
      title_contains?: string;
      school_name?: string;
      min_hours?: string;
      max_hours?: string;
      is_active?: string;
    };
  }>("/", async (req) => {
    const q = req.query;
    const skip = Math.max(0, parseInt(q.skip ?? "0", 10) || 0);
    const limit = Math.min(1000, Math.max(1, parseInt(q.limit ?? "100", 10) || 100));
    const result = await contestSearchService.search({
      skip,
      limit,
      dateFrom: q.date_from ? new Date(q.date_from) : undefined,
      dateTo: q.date_to ? new Date(q.date_to) : undefined,
      departments: q.departments ? q.departments.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      subjectId: q.subject_id != null ? parseInt(q.subject_id, 10) : undefined,
      subjectIds: q.subject_ids ? q.subject_ids.split(",").map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n)) : undefined,
      city: q.city || undefined,
      cities: q.cities ? q.cities.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      department: q.department || undefined,
      level: q.level || undefined,
      shift: q.shift || undefined,
      contractType: q.contract_type || undefined,
      sourceName: q.source_name || undefined,
      titleContains: q.title_contains || undefined,
      schoolName: q.school_name || undefined,
      minHours: q.min_hours != null ? parseInt(q.min_hours, 10) : undefined,
      maxHours: q.max_hours != null ? parseInt(q.max_hours, 10) : undefined,
      isActive: q.is_active !== undefined ? q.is_active === "true" : undefined,
    });
    return result;
  });

  // GET /api/contests/:contest_id
  app.get<{ Params: { contest_id: string } }>("/:contest_id", async (req, reply) => {
    const id = parseInt(req.params.contest_id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid contest id" });
    const contest = await contestSearchService.getContestById(id);
    if (!contest) return reply.status(404).send({ detail: "Contest not found" });
    return contest;
  });
};
