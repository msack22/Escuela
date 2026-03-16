import type { PrismaClient } from "@prisma/client";
import { config } from "../config.js";
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
function extractContestsFromHtml(html: string, baseUrl: string): ContestItem[] {
  const $ = parseHtml(html);
  const contests: ContestItem[] = [];

  $("a[href*='concurso'], a[href*='oposicion'], a[href*='cargo']").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    const title = $el.text().trim();
    if (!href || !title || title.length < 5) return;
    const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
    contests.push({ title, url: fullUrl, department: "parana" });
  });

  if (contests.length === 0) {
    $("a[href]").each((_, el) => {
      const $el = $(el);
      const href = $el.attr("href");
      const title = $el.text().trim();
      if (!href || !title || title.length < 10) return;
      if (/concurso|oposición|cargo|docente|directivo/i.test(title) || /concurso|oposicion|cargo/i.test(href)) {
        const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
        contests.push({ title, url: fullUrl, department: "parana" });
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
  opts: { anchorId: string; department: string; level: string }
): ContestItem[] {
  const $ = parseHtml(html);
  const contests: ContestItem[] = [];

  // Ancla principal de la sección. Si no existe, caemos al extractor genérico.
  const anchor = $(`#${opts.anchorId}`);
  if (anchor.length === 0) {
    return extractContestsFromHtml(html, baseUrl);
  }

  // Buscamos en el contenedor de la sección (padre más cercano "grande").
  const container = anchor.closest("section, article, div");
  const $scope = container.length ? container : anchor.parent();

  const dateRegex = /\b\d{2}\/\d{2}\/\d{4}\b/;
  let currentDate: Date | undefined;

  // Recorremos en orden los nodos dentro de la sección.
  $scope.find("*").each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();

    // Actualizamos fecha cuando encontramos algo que se parece a una fecha.
    if (dateRegex.test(text)) {
      const parsed = parseDateFromText(text);
      if (parsed) {
        currentDate = parsed;
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

export async function runCgeScraper(prisma: PrismaClient): Promise<number> {
  const timeout = config.SCRAPING_TIMEOUT_MS ?? 60000;
  const engine = config.SCRAPING_ENGINE as BrowserEngine;

  const allContests: ContestItem[] = [];

  for (let i = 0; i < DEPARTAMENTAL_PAGES.length; i++) {
    const dep = DEPARTAMENTAL_PAGES[i];
    const url = `${BASE_URL}/departamental-${dep.slug}`;

    let html: string;

    if (config.SCRAPING_PREFER_HTTP) {
      const result = await fetchHtmlOptimized(url, {
        timeout,
        engine,
        minLength: 500,
      });
      html = result.html;
    } else {
      if (engine === "puppeteer") {
        html = await fetchWithPuppeteer(url, { timeout, waitUntil: "domcontentloaded" });
      } else {
        html = await fetchWithPlaywright(url, { timeout, waitUntil: "domcontentloaded" });
      }
    }

    for (const section of LEVEL_SECTIONS) {
      const contests = extractContestsFromSection(html, BASE_URL, {
        anchorId: section.id,
        department: dep.department,
        level: section.level,
      });
      allContests.push(...contests);
    }

    // Pausa entre departamentales para no saturar el sitio.
    if (i < DEPARTAMENTAL_PAGES.length - 1) {
      const delay = 1500 + Math.floor(Math.random() * 1500);
      await sleep(delay);
    }
  }

  const contests = allContests;

  let created = 0;
  const fallbackDate = new Date();

  for (const c of contests.slice(0, 100)) {
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
      await prisma.contest.create({
        data: {
          title: c.title,
          description: "",
          // Usamos la fecha de publicación que viene en la sección de concursos.
          date: c.publishedAt ?? fallbackDate,
          school_id: school.id,
          subject_id: subject.id,
          source_url: c.url,
          source_name: SOURCE_NAME,
          is_active: true,
        },
      });
      created++;
    }
  }

  return created;
}
