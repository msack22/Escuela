import type { PrismaClient } from "@prisma/client";
import { config } from "../config.js";
import { appLogger, cgeScraperLogger } from "../lib/logger.js";
import {
  fetchWithAxios,
  fetchWithPlaywright,
  fetchWithPuppeteer,
  parseHtml,
  fetchHtmlOptimized,
  type BrowserEngine,
} from "./scraper-kit.js";

const BASE_URL = "https://cge.entrerios.gov.ar";
const SOURCE_NAME = "CGE Entre Ríos Simple";

const DEPARTAMENTAL_PAGES: Array<{ slug: string; department: string }> = [
  { slug: "colon", department: "colón" },
  { slug: "concordia", department: "concordia" },
  { slug: "diamante", department: "diamante" },
  { slug: "federacion", department: "federación" },
  { slug: "federal", department: "federal" },
  { slug: "feliciano", department: "feliciano" },
  { slug: "gualeguay", department: "gualeguay" },
  { slug: "gualeguaychu", department: "gualeguaychú" },
  { slug: "islas-del-ibicuy", department: "islas del ibicuy" },
  { slug: "la-paz", department: "la paz" },
  { slug: "nogoya", department: "nogoyá" },
  { slug: "parana", department: "paraná" },
  { slug: "san-salvador", department: "san salvador" },
  { slug: "tala", department: "tala" },
  { slug: "uruguay", department: "uruguay" },
  { slug: "victoria", department: "victoria" },
  { slug: "villaguay", department: "villaguay" },
];

const LEVEL_SECTIONS: Array<{ id: string; level: string }> = [
  { id: "concursos-nivel-secundario", level: "secundario" },
  { id: "concursos-nivel-superior", level: "superior" },
  { id: "concursos-nivel-supervisor", level: "supervisor" },
];

type ContestItem = {
  title: string;
  url: string;
  department: string;
  level?: string;
  publishedAt?: Date;
  /** Fecha específica del concurso extraída de la nota individual (si existe). */
  contestDate?: Date;
  description?: string;
};

/** Intenta parsear una fecha en formato DD/MM/YYYY de un texto. */
function parseDateFromText(text: string): Date | undefined {
  const match = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (!match) return undefined;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (!day || !month || !year) return undefined;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Extrae enlaces a concursos del HTML general (fallback, sin fechas). */
function extractContestsFromHtml(html: string, baseUrl: string, department: string = "parana"): ContestItem[] {
  const $ = parseHtml(html);
  const contests: ContestItem[] = [];

  $("a[href*='concurso'], a[href*='oposicion'], a[href*='cargo']").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    const title = $el.text().trim();
    if (!href || !title || title.length < 5) return;
    const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
    contests.push({ title, url: fullUrl, department });
  });

  if (contests.length === 0) {
    $("a[href]").each((_, el) => {
      const $el = $(el);
      const href = $el.attr("href");
      const title = $el.text().trim();
      if (!href || !title || title.length < 10) return;
      if (/concurso|oposición|cargo|docente|directivo/i.test(title) || /concurso|oposicion|cargo/i.test(href)) {
        const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
        contests.push({ title, url: fullUrl, department });
      }
    });
  }

  return contests;
}

/**
 * Extrae concursos de una sección de concursos de una DDE, usando un ancla como punto de partida.
 * Reutiliza el mismo patrón de Islas del Ibicuy para cualquier departamento / nivel.
 */
function extractContestsFromSection(
  html: string,
  baseUrl: string,
  opts: { anchorId: string; department: string; level: string; minAcceptedDate?: Date }
): ContestItem[] {
  const $ = parseHtml(html);
  const contests: ContestItem[] = [];

  // Ancla principal de la sección. Si no existe, caemos al extractor genérico.
  // En el CGE, las secciones suelen marcarse con `data-hash="concursos-nivel-..."` (y a veces también con `id`).
  const anchorById = $(`#${opts.anchorId}`);
  const anchorByDataHash = $(`[data-hash="${opts.anchorId}"]`);
  const anchor = anchorById.length ? anchorById : anchorByDataHash;
  if (anchor.length === 0) {
    // Si no encontramos el contenedor de la sección de concursos por nivel,
    // en esta estrategia evitamos el fallback genérico (para no "levantarnos"
    // links que no corresponden al listado por departamento).
    return [];
  }

  // Buscamos en el contenedor de la sección (padre más cercano "grande").
  const container = anchor.closest("section, article, div");
  const $scope = container.length ? container : anchor.parent();

  const dateRegex = /\b\d{2}\/\d{2}\/\d{4}\b/;
  let currentDate: Date | undefined;

  // Recorremos en orden los nodos dentro de la sección.
  let shouldStop = false;

  $scope.find("*").each((_, el) => {
    if (shouldStop) return;
    const $el = $(el);
    const text = $el.text().trim();

    // Actualizamos fecha cuando encontramos algo que se parece a una fecha.
    if (dateRegex.test(text)) {
      const parsed = parseDateFromText(text);
      if (parsed) {
        currentDate = parsed;
        // La web está ordenada por fecha descendente. Si encontramos una fecha
        // anterior al mínimo aceptado, dejamos de recorrer esta sección completa.
        if (opts.minAcceptedDate && parsed < opts.minAcceptedDate) {
          shouldStop = true;
        }
      }
      return;
    }

    // En esta sección nos interesan todos los ítems con fecha y link al CGE.
    // No filtramos por texto del título: cualquier enlace del dominio CGE con título válido cuenta.
    if ($el.is("a[href]")) {
      const href = $el.attr("href");
      const title = text;
      if (!href || !title || title.length < 5) return;

      const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
      const isCgeLink = fullUrl.toLowerCase().includes("cge.entrerios.gov.ar");
      // Ignorar anclas internas (solo #)
      if (!isCgeLink || href.trim().startsWith("#")) return;

      // Evitar links que existan dentro del contenedor pero no correspondan
      // a convocatorias/concursos (ej: navegación/otros).
      const titleLower = title.toLowerCase();
      const urlLower = fullUrl.toLowerCase();
      const looksLikeContest =
        /concurso|oposicion|oposición|cargo|convocatoria|opositor/i.test(titleLower) ||
        /concurso|oposicion|oposici|cargo|convocatoria/i.test(urlLower);
      if (!looksLikeContest) return;

      // Permitir sólo URLs de "post" del CGE con patrón /YYYY/MM/...
      // Esto evita que por algún cambio del template agarremos links como "/" o "/noticias/".
      const isCgePostUrl = /\/\d{4}\/\d{2}\//.test(fullUrl);
      const isNoticias = urlLower.includes("/noticias/");
      if (!isCgePostUrl || isNoticias) return;

      contests.push({
        title,
        url: fullUrl,
        department: opts.department,
        level: opts.level,
        publishedAt: currentDate,
      });
    }
  });

  // Unificar por URL para no procesar dos veces el mismo concurso
  const byUrl = new Map<string, ContestItem>();
  for (const c of contests) {
    const key = c.url.replace(/\/$/, "");
    if (!byUrl.has(key)) byUrl.set(key, c);
  }
  return Array.from(byUrl.values());
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getArgentinaYearMonth(d: Date): { year: number; month2: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const year = Number.parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10) || d.getFullYear();
  const month2 = parts.find((p) => p.type === "month")?.value ?? String(d.getMonth() + 1).padStart(2, "0");
  return { year, month2 };
}

function previousMonthYearMonth(year: number, month2: string): { year: number; month2: string } {
  const month = Number.parseInt(month2, 10) || 1;
  if (month > 1) return { year, month2: String(month - 1).padStart(2, "0") };
  return { year: year - 1, month2: "12" };
}

/**
 * Parser heurístico (sin IA) para extraer campos estructurados básicos
 * desde la descripción de un concurso:
 * - level (nivel)
 * - shift (turno)
 * - schedule (texto de horarios)
 * - hours_to_cover (suma de horas declaradas)
 *
 * Esto se puede reemplazar o complementar luego con un proceso de IA.
 */
function extractStructuredFieldsFromDescription(description?: string): {
  level?: string;
  shift?: string;
  schedule?: string;
  hours_to_cover?: number;
} {
  if (!description) return {};

  const text = description.toLowerCase();

  let level: string | undefined;
  if (/secundaria|secundario/.test(text)) level = "secundario";
  else if (/primaria|primario/.test(text)) level = "primario";
  else if (/inicial/.test(text)) level = "inicial";
  else if (/superior|instituto/.test(text)) level = "superior";

  let shift: string | undefined;
  if (/\btm\b|\bturno mañana\b/.test(text)) shift = "mañana";
  else if (/\btt\b|\bturno tarde\b/.test(text)) shift = "tarde";
  else if (/\btn\b|\bnocturno\b|\bnoche\b/.test(text)) shift = "noche";

  const lines = description.split(/\r?\n/).map((l) => l.trim());
  const scheduleLines = lines.filter((l) =>
    /(hs\b|hora|horas|\blunes\b|\bmartes\b|\bmiércoles\b|\bjueves\b|\bviernes\b|\bsábado\b|\bdomingo\b)/i.test(l)
  );

  const schedule = scheduleLines.join("\n");

  let hours_to_cover: number | undefined;
  const hourMatches = description.match(/(\d+)\s*hs\b/gi);
  if (hourMatches) {
    let total = 0;
    for (const match of hourMatches) {
      const numMatch = match.match(/(\d+)\s*hs\b/i);
      if (numMatch) {
        const n = Number(numMatch[1]);
        if (!Number.isNaN(n)) total += n;
      }
    }
    if (total > 0) hours_to_cover = total;
  }

  return { level, shift, schedule: schedule || undefined, hours_to_cover };
}

/**
 * Enriquecimiento de un concurso con información de la nota individual:
 * - descripción (texto principal)
 * - (en el futuro se puede mapear horarios, materias, etc. desde esta descripción).
 */
async function enrichContestWithDetails(contest: ContestItem, timeout: number): Promise<ContestItem> {
  try {
    const { html } = await fetchHtmlOptimized(contest.url, { timeout, minLength: 500 });

    // Algunos sitios del CGE usan mecanismos de protección (Wordfence / rate limiting)
    // que devuelven una página de bloqueo con este mensaje en lugar de la nota real.
    // En esos casos, evitamos crear concursos con descripciones basura y sólo registramos un warning.
    if (/Tu acceso a este sitio ha sido limitado por el propietario del sitio\./i.test(html)) {
      cgeScraperLogger.warn("CGE scraper → access limited page detected, skipping enrichment", {
        url: contest.url,
      });
      return contest;
    }

    const $ = parseHtml(html);

    const descriptionParts: string[] = [];

    // Patrón principal en notas de concursos departamentales (como el ejemplo).
    $(".texto p")
      .toArray()
      .forEach((el) => {
        const text = $(el).text().trim();
        if (text) descriptionParts.push(text);
      });

    // Fallbacks genéricos por si cambia el template.
    if (descriptionParts.length === 0) {
      $(".entry-content p, .post-content p, article p")
        .toArray()
        .forEach((el) => {
          const text = $(el).text().trim();
          if (text) descriptionParts.push(text);
        });
    }

    if (descriptionParts.length) {
      const fullDescription = descriptionParts.join("\n\n");
      contest.description = fullDescription;

      // Intentamos extraer una fecha específica de concurso desde el texto de la nota.
      const contestDate = parseDateFromText(fullDescription);
      if (contestDate) {
        contest.contestDate = contestDate;
      }
    }
  } catch (err) {
    cgeScraperLogger.warn("CGE scraper → failed to enrich contest details", {
      url: contest.url,
      error: (err as Error)?.message ?? String(err),
    });
  }

  return contest;
}

export async function runCgeScraper(prisma: PrismaClient): Promise<number> {
  const timeout = config.SCRAPING_TIMEOUT_MS ?? 60000;
  const engine = config.SCRAPING_ENGINE as BrowserEngine;
  // Solo conservar concursos de "ayer + hoy" (según la fecha visible en el listado del CGE).
  // Importante: normalizamos a inicio/fin del día para no depender de la hora actual.
  const now = new Date();
  const minAcceptedDate = new Date(now);
  minAcceptedDate.setDate(minAcceptedDate.getDate() - 1);
  minAcceptedDate.setHours(0, 0, 0, 0);

  const maxAcceptedDate = new Date(now);
  maxAcceptedDate.setHours(23, 59, 59, 999);

  const allContests: ContestItem[] = [];

  for (let i = 0; i < DEPARTAMENTAL_PAGES.length; i++) {
    const dep = DEPARTAMENTAL_PAGES[i];

    let contestsForDep: ContestItem[] = [];

    // Fetch UNA sola vez la página del DDE y desde ese mismo HTML extraemos
    // `secundario`, `superior` y `supervisor` (sin visitar 3 veces el mismo departamento).
    const depBaseUrl = `${BASE_URL}/departamental-${dep.slug}`;
    cgeScraperLogger.info("CGE scraper → fetching departamental page (all levels)", {
      url: depBaseUrl,
      department: dep.department,
      slug: dep.slug,
      engine,
    });

    let html: string;
    if (config.SCRAPING_PREFER_HTTP) {
      const result = await fetchHtmlOptimized(depBaseUrl, {
        timeout,
        engine,
        minLength: 500,
      });
      html = result.html;
      cgeScraperLogger.info("CGE scraper → fetched HTML (optimized)", {
        url: depBaseUrl,
        via: result.via,
        length: html.length,
      });
    } else {
      if (engine === "puppeteer") {
        html = await fetchWithPuppeteer(depBaseUrl, { timeout, waitUntil: "domcontentloaded" });
      } else {
        html = await fetchWithPlaywright(depBaseUrl, { timeout, waitUntil: "domcontentloaded" });
      }
      cgeScraperLogger.info("CGE scraper → fetched HTML (browser)", {
        url: depBaseUrl,
        engine,
        length: html.length,
      });
    }

    for (const section of LEVEL_SECTIONS) {
      const contests = extractContestsFromSection(html, BASE_URL, {
        anchorId: section.id,
        department: dep.department,
        level: section.level,
        minAcceptedDate,
      });
      contestsForDep.push(...contests);

      cgeScraperLogger.info("CGE scraper → contests found in section", {
        url: depBaseUrl,
        department: dep.department,
        level: section.level,
        anchorId: section.id,
        count: contests.length,
      });
    }

    // No usamos fallback genérico: si una DDE no devuelve nada en las secciones,
    // asumimos que el HTML no trae esos listados y la omitimos para evitar ruido.
    if (contestsForDep.length === 0) {
      cgeScraperLogger.warn("CGE scraper → no contests in structured sections (skipping)", {
        url: depBaseUrl,
        department: dep.department,
      });
    }

    // Para cada departamento nos quedamos sólo con los concursos más recientes
    // (top 20 ordenados por fecha descendente; si no hay fecha usamos 0).
    const sortedForDep = [...contestsForDep].sort((a, b) => {
      const ta = a.publishedAt ? a.publishedAt.getTime() : 0;
      const tb = b.publishedAt ? b.publishedAt.getTime() : 0;
      return tb - ta;
    });
    const topForDep = sortedForDep.slice(0, 20);

    allContests.push(...topForDep);

    // Pausa entre departamentales para no saturar ni ser bloqueados.
    if (i < DEPARTAMENTAL_PAGES.length - 1) {
      // Antes: ~2,5–4,5 s. Ahora lo hacemos más “lento y amable” (~5–9 s).
      const delay = 5000 + Math.floor(Math.random() * 4000);
      await sleep(delay);
    }
  }

  // Normalizamos URLs para evitar duplicados con y sin barra final.
  const normalizeUrl = (url: string) => url.replace(/\/$/, "");

  // Para evitar re-procesar (y re-visitar) notas individuales que ya están en la base,
  // traemos los concursos del CGE que pertenecen al mes actual y construimos un set de URLs.
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const existingThisMonth = await prisma.contest.findMany({
    where: {
      source_name: SOURCE_NAME,
      date: { gte: startOfMonth },
    },
    select: { source_url: true },
  });
  const existingUrlSet = new Set(
    existingThisMonth
      .map((c) => c.source_url)
      .filter((u): u is string => typeof u === "string" && !!u)
      .map((u) => normalizeUrl(u)),
  );

  // Nos quedamos sólo con concursos que no estén ya en la base (para este mes),
  // así no volvemos a entrar a páginas de detalle repetidas.
  const contests = allContests.filter((c) => !existingUrlSet.has(normalizeUrl(c.url)));

  let created = 0;
  const fallbackDate = new Date();

  // Enriquecemos cada concurso con la información de la nota individual
  // (descripción detallada, horarios, etc.) antes de persistirlo.
  // Para cuidar el sitio del CGE cuando corremos varias veces al día,
  // limitamos la cantidad de notas individuales que visitamos por ciclo.
  const MAX_ENRICH_PER_RUN = 100;

  // Damos prioridad a los concursos más recientes y a ciertos departamentos clave.
  // 1) filtramos por fecha mínima aceptada (cuando la conocemos)
  // 2) antes filtrábamos siempre por el mes de la URL para evitar notas viejas,
  //    pero algunos concursos "de hoy" pueden estar publicados con fecha distinta
  //    en la URL (WordPress agrupa por fecha de publicación del post).
  //    Ahora: si tenemos `publishedAt` usamos esa fecha; si no existe, caemos
  //    al filtro por mes en la URL para reducir ruido.
  // 3) ordenamos por prioridad de departamento y luego por publishedAt desc
  const candidateContests = contests.filter((c) => {
    // Si no podemos parsear la fecha del listado, no entra (evita ruido viejo).
    if (!c.publishedAt) return false;
    return c.publishedAt >= minAcceptedDate && c.publishedAt <= maxAcceptedDate;
  });

  const { year: currentYear, month2: currentMonth2 } = getArgentinaYearMonth(new Date());
  const allowedFragments = [`/${currentYear}/${currentMonth2}/`];

  // Doble validación:
  // 1) `publishedAt` dentro de "ayer + hoy" (filtro de fecha)
  // 2) la `url` también debe estar dentro del mes/año actual (filtro por URL)
  const filteredByUrl = candidateContests.filter((c) => {
    const url = c.url ?? "";
    if (!url) return false;
    if (url.includes("jurado-de-concursos-noticias")) return false;
    return allowedFragments.some((frag) => url.includes(frag));
  });

  if (filteredByUrl.length !== candidateContests.length) {
    cgeScraperLogger.info("CGE scraper → URL month filter applied", {
      allowed: allowedFragments,
      before: candidateContests.length,
      after: filteredByUrl.length,
    });
  }

  const PRIORITY_DEPARTMENTS = new Set<string>([
    "islas del ibicuy",
    "islas-del-ibicuy",
    "gualeguaychú",
    "gualeguaychu",
    "gualeguay",
  ]);

  filteredByUrl.sort((a, b) => {
    const depA = (a.department ?? "").toLowerCase();
    const depB = (b.department ?? "").toLowerCase();
    const aPriority = PRIORITY_DEPARTMENTS.has(depA) ? 1 : 0;
    const bPriority = PRIORITY_DEPARTMENTS.has(depB) ? 1 : 0;

    if (aPriority !== bPriority) {
      // Primero los concursos de departamentos prioritarios
      return bPriority - aPriority;
    }

    const ta = a.publishedAt ? a.publishedAt.getTime() : 0;
    const tb = b.publishedAt ? b.publishedAt.getTime() : 0;
    return tb - ta;
  });

  const enrichedContests: ContestItem[] = [];
  const toEnrich = filteredByUrl.slice(0, MAX_ENRICH_PER_RUN);
  cgeScraperLogger.info("CGE scraper → enriching details", {
    count: toEnrich.length,
    max: MAX_ENRICH_PER_RUN,
    priority_departments: Array.from(PRIORITY_DEPARTMENTS),
  });

  for (let idx = 0; idx < toEnrich.length; idx++) {
    const c = toEnrich[idx];
    if ((idx + 1) % 10 === 0 || idx === 0 || idx === toEnrich.length - 1) {
      cgeScraperLogger.info("CGE scraper → progress", {
        current: idx + 1,
        total: toEnrich.length,
        url: c.url,
      });
    }

    const enriched = await enrichContestWithDetails(c, timeout);
    enrichedContests.push(enriched);

    // Pausa entre link y link para no saturar ni ser bloqueados por la web.
    // Antes: ~1,5–3 s. Ahora: ~3–5 s.
    const delayMs = 3000 + Math.floor(Math.random() * 2000);
    await sleep(delayMs);
  }

  cgeScraperLogger.info("CGE scraper → enrichment finished", {
    enriched: enrichedContests.length,
    planned: toEnrich.length,
  });

  for (const c of enrichedContests) {
    // Normalizamos nombre y slug de departamento para usar tabla Department.
    const rawDep = c.department || "Sin departamento";
    const canonicalName = rawDep
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    const slug = canonicalName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-");

    let department = await prisma.department.findFirst({
      where: { OR: [{ slug }, { name: canonicalName }] },
    });
    if (!department) {
      department = await prisma.department.create({
        data: { name: canonicalName, slug },
      });
    }

    let school = await prisma.school.findFirst({
      where: {
        department_id: department.id,
        city: { contains: c.department },
      },
    });
    if (!school) {
      school = await prisma.school.create({
        data: {
          name: `CGE ${canonicalName}`,
          city: canonicalName,
          department: canonicalName,
          department_id: department.id,
        },
      });
    }

    let subject = await prisma.subject.findFirst({ where: { name: "General" } });
    if (!subject) {
      subject = await prisma.subject.create({ data: { name: "General" } });
    }

    const existing = await prisma.contest.findFirst({
      where: { source_url: c.url, source_name: SOURCE_NAME },
    });
    if (!existing) {
      const structured = extractStructuredFieldsFromDescription(c.description);
      const publicationDate = c.publishedAt ?? fallbackDate;
      // Si desde la nota individual pudimos extraer una fecha concreta de concurso,
      // la usamos como `date` principal; si no, usamos la fecha de publicación.
      const contestDate = c.contestDate ?? publicationDate;

      await prisma.contest.create({
        data: {
          title: c.title,
          description: c.description ?? "",
          date: contestDate,
          publication_date: publicationDate,
          level: structured.level ?? c.level,
          shift: structured.shift,
          schedule: structured.schedule,
          hours_to_cover: structured.hours_to_cover,
          school_id: school.id,
          subject_id: subject.id,
          source_url: c.url,
          source_name: SOURCE_NAME,
          is_active: true,
          is_processed: true,
        },
      });
      created++;
    }
  }

  return created;
}
