import { prisma } from "../db.js";

const SOURCES_CAPACITACIONES_ONLY = new Set([
  "Educación Argentina",
  "Datos Abiertos Argentina",
  "Puntos Digitales",
]);

const LEVELS_EXCLUDED_BY_DEFAULT = ["Primaria", "Inicial"];

function normalizePlaceName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  const particles = new Set(["de", "del", "la", "las", "los", "y"]);
  return lower
    .split(" ")
    .map((w, idx) => {
      if (idx > 0 && particles.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export interface ContestSearchFilters {
  skip?: number;
  limit?: number;
  dateFrom?: Date;
  dateTo?: Date;
  departments?: string[];
  subjectIds?: number[];
  subjectId?: number;
  subjectContains?: string;
  cities?: string[];
  city?: string;
  department?: string;
  level?: string;
  shift?: string;
  contractType?: string;
  sourceName?: string;
  titleContains?: string;
  schoolName?: string;
  minHours?: number;
  maxHours?: number;
  isActive?: boolean;
}

export const contestSearchService = {
  async search(filters: ContestSearchFilters) {
    const skip = Math.max(0, filters.skip ?? 0);
    const limit = Math.min(1000, Math.max(1, filters.limit ?? 100));

    const where: Record<string, unknown> = {};
    if (filters.isActive !== undefined) where.is_active = filters.isActive;
    if (filters.sourceName) {
      where.source_name = filters.sourceName;
    } else {
      where.source_name = { notIn: Array.from(SOURCES_CAPACITACIONES_ONLY) };
    }
    if (filters.level) {
      where.level = filters.level;
    } else {
      where.level = { notIn: LEVELS_EXCLUDED_BY_DEFAULT };
    }
    if (filters.shift) where.shift = filters.shift;
    if (filters.contractType) where.contract_type = filters.contractType;
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) (where.date as Record<string, Date>).gte = filters.dateFrom;
      if (filters.dateTo) (where.date as Record<string, Date>).lte = filters.dateTo;
    }
    if (filters.subjectIds?.length) {
      where.subject_id = { in: filters.subjectIds };
    } else if (filters.subjectId != null) {
      where.subject_id = filters.subjectId;
    }
    if (filters.subjectContains?.trim()) {
      where.subject = {
        ...(where.subject as Record<string, unknown> || {}),
        name: { contains: filters.subjectContains.trim() },
      };
    }
    if (filters.titleContains?.trim()) {
      where.title = { contains: filters.titleContains };
    }
    if (filters.minHours != null) where.hours_to_cover = { ...((where.hours_to_cover as object) || {}), gte: filters.minHours };
    if (filters.maxHours != null) where.hours_to_cover = { ...((where.hours_to_cover as object) || {}), lte: filters.maxHours };
    if (filters.departments?.length || filters.cities?.length || filters.department || filters.city || filters.schoolName) {
      where.school = where.school as Record<string, unknown> || {};
      if (filters.departments?.length) {
        (where.school as Record<string, unknown>).department = { in: filters.departments };
      } else if (filters.department) {
        (where.school as Record<string, unknown>).department = { contains: filters.department };
      }
      if (filters.cities?.length) {
        (where.school as Record<string, unknown>).city = { in: filters.cities };
      } else if (filters.city) {
        (where.school as Record<string, unknown>).city = { contains: filters.city };
      }
      if (filters.schoolName?.trim()) {
        (where.school as Record<string, unknown>).name = { contains: filters.schoolName };
      }
    }

    const [contests, total] = await Promise.all([
      prisma.contest.findMany({
        where,
        skip,
        take: limit,
        // Ordenamos de más recientes a más antiguos priorizando fecha de publicación.
        // Fallbacks: `date` (si no hay publication_date) y luego `created_at`.
        orderBy: [
          // Prisma soporta nulls: last en orderBy para Postgres/MySQL recientes.
          // Si el motor no lo soportara, el fallback por `date`/`created_at` igual mantiene un orden estable.
          { publication_date: { sort: "desc", nulls: "last" } },
          { date: "desc" },
          { created_at: "desc" },
        ],
        include: { school: true, subject: true, items: { include: { subject: true } } },
      }),
      prisma.contest.count({ where }),
    ]);

    return {
      contests: contests.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        date: c.date.toISOString(),
        registration_deadline: c.registration_deadline?.toISOString() ?? null,
        publication_date: c.publication_date?.toISOString() ?? null,
        level: c.level,
        shift: c.shift,
        schedule: c.schedule,
        hours_to_cover: c.hours_to_cover,
        contract_type: c.contract_type,
        source_url: c.source_url,
        source_name: c.source_name,
        school: c.school
          ? {
              id: c.school.id,
              name: c.school.name,
              city: c.school.city,
              department: c.school.department,
              address: c.school.address,
            }
          : null,
        subject: c.subject
          ? { id: c.subject.id, name: c.subject.name }
          : null,
        items: c.items.map((item) => ({
          subject: item.subject.name,
          hours: item.hours_to_cover,
          grade: item.grade,
          llamado: item.llamado,
          caracter: item.caracter,
        })),
        source: { url: c.source_url, name: c.source_name },
        is_active: c.is_active,
        parent_contest_id: c.parent_contest_id ?? null,
      })),
      total,
      skip,
      limit,
    };
  },

  async getContestById(contestId: number) {
    const c = await prisma.contest.findUnique({
      where: { id: contestId },
      include: { school: true, subject: true },
    });
    if (!c) return null;
    const dt = (v: Date | null) => (v ? v.toISOString() : null);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      date: dt(c.date),
      registration_deadline: dt(c.registration_deadline),
      publication_date: dt(c.publication_date),
      level: c.level,
      shift: c.shift,
      schedule: c.schedule,
      hours_to_cover: c.hours_to_cover,
      contract_type: c.contract_type,
      source_url: c.source_url,
      source_name: c.source_name,
      school: c.school ? { id: c.school.id, name: c.school.name, city: c.school.city, department: c.school.department, address: c.school.address, latitude: c.school.latitude, longitude: c.school.longitude, school_type: c.school.school_type, school_number: c.school.school_number } : null,
      subject: c.subject ? { id: c.subject.id, name: c.subject.name, description: c.subject.description } : null,
      source: { url: c.source_url, name: c.source_name },
      is_active: c.is_active,
      created_at: dt(c.created_at),
      updated_at: dt(c.updated_at),
    };
  },

  async getStatistics() {
    const [total_contests, active_contests, total_schools, total_subjects] = await Promise.all([
      prisma.contest.count(),
      prisma.contest.count({ where: { is_active: true } }),
      prisma.school.count(),
      prisma.subject.count(),
    ]);
    return { total_contests, active_contests, total_schools, total_subjects, contests_by_month: [] };
  },

  async getAllSubjects() {
    const list = await prisma.subject.findMany({ orderBy: { name: "asc" } });
    return list.map((s) => ({ id: s.id, name: s.name, description: s.description }));
  },

  async getAllCities(): Promise<string[]> {
    const rows = await prisma.school.findMany({ select: { city: true } });
    const dedup = new Map<string, string>();
    for (const r of rows) {
      const raw = (r.city ?? "").trim();
      if (!raw) continue;
      const canonical = normalizePlaceName(raw);
      const key = canonical
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (!dedup.has(key)) dedup.set(key, canonical);
    }
    return Array.from(dedup.values()).sort((a, b) => a.localeCompare(b, "es"));
  },

  async getAllDepartments(): Promise<string[]> {
    // Preferimos la tabla Department normalizada. Si no hay filas (instalación vieja),
    // caemos al listado por escuelas.
    const depRows = await prisma.department.findMany({ select: { name: true }, orderBy: { name: "asc" } });
    if (depRows.length > 0) {
      return depRows.map((d) => d.name).filter(Boolean) as string[];
    }

    const rows = await prisma.school.findMany({
      select: { department: true },
      distinct: ["department"],
    });
    return rows.map((r) => r.department).filter(Boolean) as string[];
  },

  async getAllSources(): Promise<{ name: string }[]> {
    const rows = await prisma.contest.findMany({ select: { source_name: true }, distinct: ["source_name"] });
    return rows
      .map((r) => r.source_name)
      .filter((n) => n && !SOURCES_CAPACITACIONES_ONLY.has(n.trim()))
      .map((name) => ({ name: name! }));
  },
};
