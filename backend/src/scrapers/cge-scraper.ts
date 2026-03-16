import type { PrismaClient } from "@prisma/client";
import { config } from "../config.js";
import { appLogger } from "../lib/logger.js";
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
  const anchor = $(`#${opts.anchorId}`);
  if (anchor.length === 0) {
    return extractContestsFromHtml(html, baseUrl, opts.department);
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

    // Links de concursos: normalmente son enlaces a notas con "concurso", "suplencia" o "supervisor".
    if ($el.is("a[href]")) {
      const href = $el.attr("href");
      const title = text;
      if (!href || !title || title.length < 5) return;

      const normalizedTitle = title.toLowerCase();
      const normalizedHref = href.toLowerCase();
      const isContestLike =
        /concurso|suplencia|supervisor/i.test(normalizedTitle) ||
        /concurso|suplencia|supervisor/i.test(normalizedHref);

      if (!isContestLike) return;

      const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;

      contests.push({
        title,
        url: fullUrl,
        department: opts.department,
        level: opts.level,
        publishedAt: currentDate,
      });
    }
  });

  return contests;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
    appLogger.warn("CGE scraper → failed to enrich contest details", {
      url: contest.url,
      error: (err as Error)?.message ?? String(err),
    });
  }

  return contest;
}

export async function runCgeScraper(prisma: PrismaClient): Promise<number> {
  const timeout = config.SCRAPING_TIMEOUT_MS ?? 60000;
  const engine = config.SCRAPING_ENGINE as BrowserEngine;
  // Solo conservar concursos de los últimos 2 días (desde el momento de ejecución).
  const minAcceptedDate = new Date();
  minAcceptedDate.setDate(minAcceptedDate.getDate() - 2);

  const allContests: ContestItem[] = [];

  for (let i = 0; i < DEPARTAMENTAL_PAGES.length; i++) {
    const dep = DEPARTAMENTAL_PAGES[i];

    let contestsForDep: ContestItem[] = [];

    // Para cada nivel navegamos explícitamente a la URL con hash,
    // así el front del CGE puede usar location.hash para cargar/filtrar contenidos.
    for (const section of LEVEL_SECTIONS) {
      const urlWithHash = `${BASE_URL}/departamental-${dep.slug}/#${section.id}`;

      appLogger.info("CGE scraper → fetching departamental section", {
        url: urlWithHash,
        department: dep.department,
        slug: dep.slug,
        level: section.level,
        anchorId: section.id,
        engine,
      });

      // Forzamos navegador porque axios ignora el hash y no ejecuta JS.
      let html: string;
      if (engine === "puppeteer") {
        html = await fetchWithPuppeteer(urlWithHash, { timeout, waitUntil: "networkidle" });
      } else {
        html = await fetchWithPlaywright(urlWithHash, { timeout, waitUntil: "networkidle" });
      }

      appLogger.info("CGE scraper → fetched HTML (browser section)", {
        url: urlWithHash,
        engine,
        length: html.length,
      });

      const contests = extractContestsFromSection(html, BASE_URL, {
        anchorId: section.id,
        department: dep.department,
        level: section.level,
        minAcceptedDate,
      });
      contestsForDep.push(...contests);

      appLogger.info("CGE scraper → contests found in section", {
        url: urlWithHash,
        department: dep.department,
        level: section.level,
        anchorId: section.id,
        count: contests.length,
      });
    }

    // Si ninguna sección devolvió concursos, usamos el extractor genérico en la página base.
    if (contestsForDep.length === 0) {
      const baseUrl = `${BASE_URL}/departamental-${dep.slug}`;

      appLogger.info("CGE scraper → fetching departamental page for fallback", {
        url: baseUrl,
        department: dep.department,
        slug: dep.slug,
        engine,
      });

      let html: string;
      if (config.SCRAPING_PREFER_HTTP) {
        const result = await fetchHtmlOptimized(baseUrl, {
          timeout,
          engine,
          minLength: 500,
        });
        html = result.html;
        appLogger.info("CGE scraper → fetched HTML (optimized fallback)", {
          url: baseUrl,
          via: result.via,
          length: html.length,
        });
      } else {
        if (engine === "puppeteer") {
          html = await fetchWithPuppeteer(baseUrl, { timeout, waitUntil: "domcontentloaded" });
        } else {
          html = await fetchWithPlaywright(baseUrl, { timeout, waitUntil: "domcontentloaded" });
        }
        appLogger.info("CGE scraper → fetched HTML (browser fallback)", {
          url: baseUrl,
          engine,
          length: html.length,
        });
      }

      const fallbackContests = extractContestsFromHtml(html, BASE_URL, dep.department);
      appLogger.warn("CGE scraper → no contests in structured sections, using generic extractor", {
        url: baseUrl,
        department: dep.department,
        fallbackCount: fallbackContests.length,
      });
      contestsForDep.push(...fallbackContests);
    }

    allContests.push(...contestsForDep);

    // Pausa entre departamentales para no saturar el sitio.
    if (i < DEPARTAMENTAL_PAGES.length - 1) {
      const delay = 1500 + Math.floor(Math.random() * 1500);
      await sleep(delay);
    }
  }

  const contests = allContests;

  let created = 0;
  const fallbackDate = new Date();

  // Enriquecemos cada concurso con la información de la nota individual
  // (descripción detallada, horarios, etc.) antes de persistirlo.
  const enrichedContests: ContestItem[] = [];
  for (const c of contests.slice(0, 100)) {
    // Saltamos concursos demasiado antiguos cuando hay fecha conocida,
    // y de paso evitamos hacer requests innecesarias a sus notas individuales.
    if (c.publishedAt && c.publishedAt < minAcceptedDate) {
      continue;
    }

    const enriched = await enrichContestWithDetails(c, timeout);
    enrichedContests.push(enriched);

    // Pequeña pausa para no saturar el sitio al pedir notas individuales.
    await sleep(200);
  }

  for (const c of enrichedContests) {
    let school = await prisma.school.findFirst({
      where: { department: c.department, city: { contains: c.department } },
    });
    if (!school) {
      school = await prisma.school.create({
        data: {
          name: `CGE ${c.department}`,
          city: c.department,
          department: c.department,
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
