import type { PrismaClient } from "@prisma/client";
import axios from "axios";
import { appLogger, cgeScraperLogger } from "../lib/logger.js";
import {
  extractContestFieldsFromText,
  enrichContestFieldsWithAI,
} from "../services/contest-text-parser.js";
import { normalizeSubjectName, getItemType } from "../lib/subject-normalizer.js";

const SOURCE_NAME = "CGE Entre Ríos API";
const WP_API = "https://cge.entrerios.gov.ar/wp-json/wp/v2/posts";

/**
 * Categorías de nivel en el WordPress del CGE.
 * El nivel se infiere de la categoría del post, no de la URL.
 */
const LEVEL_CATEGORIES: Array<{ id: number; level: string }> = [
  { id: 149, level: "Inicial" },
  { id: 150, level: "Primaria" },
  { id: 151, level: "Secundaria" },
  { id: 152, level: "Superior" },
  { id: 208, level: "Supervisor" },
];

/**
 * Departamentos y keywords para detectar departamento a partir de la URL del post.
 * Orden importa: gualeguaychu antes que gualeguay para evitar falsos positivos.
 */
const DEPARTMENT_CONFIGS: Array<{
  slug: string;
  name: string;
  keywords: string[];
}> = [
  {
    slug: "islas-del-ibicuy",
    name: "Islas del Ibicuy",
    keywords: ["ibicuy", "ceibas", "paranacito", "mazaruca", "giorgi", "islas-del-ibicuy", "nep-nina"],
  },
  {
    slug: "gualeguaychu",
    name: "Gualeguaychú",
    keywords: ["gualeguaychu"],
  },
  {
    slug: "gualeguay",
    name: "Gualeguay",
    keywords: ["gualeguay"],
  },
  {
    slug: "uruguay",
    name: "Uruguay",
    keywords: ["concepcion-del-uruguay", "colonia-elias", "colonia-larroque", "dde-uruguay"],
  },
];

type WpPost = {
  id: number;
  date: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  categories: number[];
};

/** Convierte HTML a texto plano eliminando tags y normalizando espacios. */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Detecta el departamento a partir de keywords en la URL del post. */
function detectDepartment(url: string): { slug: string; name: string } | null {
  const lower = url.toLowerCase();
  for (const dep of DEPARTMENT_CONFIGS) {
    if (dep.keywords.some((kw) => lower.includes(kw))) {
      return { slug: dep.slug, name: dep.name };
    }
  }
  return null;
}

/** Detecta el nivel educativo a partir de las categorías del post. */
function detectLevel(categories: number[]): string | null {
  for (const cat of LEVEL_CATEGORIES) {
    if (categories.includes(cat.id)) return cat.level;
  }
  return null;
}

/**
 * Obtiene posts de la WordPress REST API del CGE para una categoría y mes dados.
 * Pagina automáticamente hasta agotar los resultados.
 */
async function fetchPostsByCategory(
  categoryId: number | null,
  afterDate: string,
  beforeDate: string,
): Promise<WpPost[]> {
  const posts: WpPost[] = [];
  let page = 1;

  while (true) {
    try {
      const params: Record<string, unknown> = {
        per_page: 100,
        page,
        after: afterDate,
        before: beforeDate,
        orderby: "date",
        order: "desc",
        _fields: "id,date,link,title,content,categories",
      };
      if (categoryId !== null) params.categories = categoryId;

      const { data } = await axios.get<WpPost[]>(WP_API, {
        params,
        timeout: 25_000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; EscuelaCGEScraper/1.0)",
          "Accept": "application/json",
        },
      });

      if (!Array.isArray(data) || data.length === 0) break;
      posts.push(...data);
      if (data.length < 100) break;
      page++;
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      // WordPress devuelve 400 si el parámetro `page` excede el total de páginas
      if (status === 400) break;
      // Cualquier otro error (500, timeout, red) indica API no disponible
      throw err;
    }
  }

  return posts;
}

export class CgeApiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CgeApiUnavailableError";
  }
}

export async function runCgeApiScraper(prisma: PrismaClient): Promise<number> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  // Ventana: desde hace 3 días (00:00:00) hasta el momento actual
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  threeDaysAgo.setHours(0, 0, 0, 0);
  const afterDate = threeDaysAgo.toISOString().slice(0, 19);
  const beforeDate = now.toISOString().slice(0, 19);

  appLogger.info("Iniciando CGE API scraper", { afterDate, beforeDate });
  cgeScraperLogger.info("CGE API scraper → inicio", { afterDate, beforeDate });

  // Obtener URLs ya guardadas este mes para este source (evita re-procesar)
  const startOfMonth = new Date(year, now.getMonth(), 1);
  const existingContests = await prisma.contest.findMany({
    where: { source_name: SOURCE_NAME, created_at: { gte: startOfMonth } },
    select: { source_url: true },
  });
  const existingUrlSet = new Set(
    existingContests
      .map((c) => c.source_url)
      .filter((u): u is string => !!u)
      .map((u) => u.replace(/\/$/, "")),
  );

  // También considerar URLs ya guardadas por los scrapers anteriores (evita duplicados entre sources)
  const existingAllSources = await prisma.contest.findMany({
    where: {
      created_at: { gte: startOfMonth },
      source_url: { contains: `cge.entrerios.gov.ar/${year}/${month}/` },
    },
    select: { source_url: true },
  });
  for (const c of existingAllSources) {
    if (c.source_url) existingUrlSet.add(c.source_url.replace(/\/$/, ""));
  }

  // Recolectar todos los posts del mes agrupados por nivel
  const allPosts = new Map<string, WpPost>(); // key = URL normalizada

  const LEVELS_SKIP = new Set(["Primaria", "Inicial"]);
  let apiSuccessCount = 0;
  let apiErrorCount = 0;

  for (const levelCat of LEVEL_CATEGORIES) {
    if (LEVELS_SKIP.has(levelCat.level)) {
      cgeScraperLogger.info("CGE API scraper → nivel excluido, se omite", { level: levelCat.level });
      continue;
    }

    cgeScraperLogger.info("CGE API scraper → fetching categoría", {
      categoryId: levelCat.id,
      level: levelCat.level,
    });

    let posts: WpPost[];
    try {
      posts = await fetchPostsByCategory(levelCat.id, afterDate, beforeDate);
      apiSuccessCount++;
    } catch (err) {
      apiErrorCount++;
      cgeScraperLogger.warn("CGE API scraper → error al obtener categoría", {
        level: levelCat.level,
        error: (err as Error)?.message ?? String(err),
      });
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }

    cgeScraperLogger.info("CGE API scraper → posts obtenidos", {
      categoryId: levelCat.id,
      level: levelCat.level,
      count: posts.length,
    });

    for (const post of posts) {
      const normalized = (post.link ?? "").replace(/\/$/, "");
      if (!normalized || allPosts.has(normalized)) continue;

      // Solo nos interesan posts de los departamentos configurados
      const dep = detectDepartment(normalized);
      if (!dep) continue;

      allPosts.set(normalized, post);
    }

    // Pausa entre categorías para no saturar la API
    await new Promise((r) => setTimeout(r, 500));
  }

  // Palabras clave que identifican niveles que no nos interesan (Primaria / Inicial).
  // Se aplican al título del post del catch-all, donde no hay categoría de nivel.
  const SKIP_LEVEL_KEYWORDS = [
    "primaria", "nivel primario", "nivel inicial", "inicial", "jardín", "jardin", "jardines",
  ];
  function isCatchAllPostSkipped(post: WpPost): boolean {
    const title = htmlToText(post.title?.rendered ?? "").toLowerCase();
    return SKIP_LEVEL_KEYWORDS.some((kw) => title.includes(kw));
  }

  // Pase extra por categoría 68 "Concursos" (catch-all): captura posts que solo tienen
  // la categoría general sin nivel específico (ej. DDE Islas del Ibicuy sin categoría de nivel).
  // La deduplicación por URL evita re-procesar los ya encontrados.
  const CONCURSOS_CATEGORY_ID = 68;
  cgeScraperLogger.info("CGE API scraper → pase extra categoría Concursos (catch-all)", { categoryId: CONCURSOS_CATEGORY_ID });
  try {
    const extraPosts = await fetchPostsByCategory(CONCURSOS_CATEGORY_ID, afterDate, beforeDate);
    apiSuccessCount++;
    for (const post of extraPosts) {
      const normalized = (post.link ?? "").replace(/\/$/, "");
      if (!normalized || allPosts.has(normalized)) continue;
      const dep = detectDepartment(normalized);
      if (!dep) continue;
      if (isCatchAllPostSkipped(post)) {
        const title = htmlToText(post.title?.rendered ?? "").toLowerCase();
        const matched = SKIP_LEVEL_KEYWORDS.find((kw) => title.includes(kw));
        cgeScraperLogger.info("CGE API scraper → catch-all post descartado por nivel", {
          title: post.title?.rendered,
          url: normalized,
          keyword: matched,
        });
        await prisma.discardedPost.createMany({
          data: [{
            source_name: SOURCE_NAME,
            url: normalized,
            title: post.title?.rendered ?? "",
            reason: "level_keyword",
            keyword_matched: matched ?? null,
            post_date: post.date ? new Date(post.date) : null,
          }],
          skipDuplicates: true,
        }).catch(() => {
          // Si falla (ej. url muy larga) seguimos sin interrumpir el scraping
        });
        continue;
      }
      allPosts.set(normalized, post);
    }
    cgeScraperLogger.info("CGE API scraper → pase extra finalizado", { extra: extraPosts.length });
  } catch (err) {
    apiErrorCount++;
    cgeScraperLogger.warn("CGE API scraper → error en pase extra", {
      error: (err as Error)?.message ?? String(err),
    });
  }

  // Si todas las categorías fallaron, la API está caída — lanzamos para activar fallback
  if (apiSuccessCount === 0 && apiErrorCount > 0) {
    cgeScraperLogger.warn("CGE API scraper → todas las categorías fallaron, API no disponible", { apiErrorCount });
    throw new CgeApiUnavailableError("CGE WordPress API no disponible (todas las categorías devolvieron error)");
  }

  cgeScraperLogger.info("CGE API scraper → posts relevantes encontrados", {
    total: allPosts.size,
    apiSuccessCount,
    apiErrorCount,
  });

  let created = 0;

  for (const [normalizedUrl, post] of allPosts.entries()) {
    if (existingUrlSet.has(normalizedUrl)) {
      cgeScraperLogger.info("CGE API scraper → ya existe, se omite", { url: normalizedUrl });
      continue;
    }

    const dep = detectDepartment(normalizedUrl)!;
    const levelFromCat = detectLevel(post.categories);

    const titleText = htmlToText(post.title?.rendered ?? "");
    const contentText = htmlToText(post.content?.rendered ?? "");
    const fullText = [titleText, contentText].filter(Boolean).join("\n\n");

    cgeScraperLogger.info("CGE API scraper → procesando post", {
      url: normalizedUrl,
      department: dep.name,
      level: levelFromCat,
      titlePreview: titleText.slice(0, 80),
    });

    // Parsear campos del concurso desde el texto
    const publishedAt = post.date ? new Date(post.date) : new Date();
    const regexFields = extractContestFieldsFromText({
      title: titleText,
      description: fullText,
      fallbackPublicationDate: publishedAt,
      fallbackLevel: levelFromCat ?? undefined,
    });

    // Enriquecer con AI para mejor extracción de materia, turno, horas, etc.
    const structured = await enrichContestFieldsWithAI(regexFields, fullText);

    // publication_date: siempre la fecha real del post en la API de WordPress
    const publicationDate = publishedAt;
    // contest_date: fecha del concurso extraída del contenido del post; si no se encuentra, usamos publication_date como fallback
    const contestDate = structured.contestDate ?? publicationDate;

    // Resolver o crear departamento
    const canonicalName = dep.name;
    let department = await prisma.department.findFirst({
      where: { OR: [{ slug: dep.slug }, { name: canonicalName }] },
    });
    if (!department) {
      department = await prisma.department.create({
        data: { name: canonicalName, slug: dep.slug },
      });
    }

    // Resolver o crear escuela: usamos el nombre extraído por la IA si está disponible,
    // de lo contrario usamos un placeholder con el nombre del departamento.
    const schoolName = structured.schoolName?.trim().slice(0, 255) || `CGE ${canonicalName}`;
    let school = await prisma.school.findFirst({
      where: { name: schoolName, department_id: department.id },
    });
    if (!school) {
      school = await prisma.school.create({
        data: {
          name: schoolName,
          city: canonicalName,
          department: canonicalName,
          department_id: department.id,
        },
      });
    }

    // Resolver subjects para todos los items extraídos
    const resolvedItems: { subjectName: string; subjectId: number; hoursToCover: number | null; itemType: string }[] = [];
    for (const item of structured.items) {
      const subjectName = (normalizeSubjectName(item.subjectName) ?? item.subjectName ?? "General").slice(0, 255);
      let subject = await prisma.subject.findFirst({ where: { name: subjectName } });
      if (!subject) subject = await prisma.subject.create({ data: { name: subjectName } });
      resolvedItems.push({ subjectName, subjectId: subject.id, hoursToCover: item.hoursToCover ?? null, itemType: getItemType(subjectName) });
    }

    // Fallback si la extracción no encontró ningún item
    if (resolvedItems.length === 0) {
      let subject = await prisma.subject.findFirst({ where: { name: "General" } });
      if (!subject) subject = await prisma.subject.create({ data: { name: "General" } });
      resolvedItems.push({ subjectName: "General", subjectId: subject.id, hoursToCover: null, itemType: "materia" });
    }

    // Crear UN concurso + N ContestItems en transacción
    const primaryItem = resolvedItems[0];
    await prisma.$transaction(async (tx) => {
      const contest = await tx.contest.create({
        data: {
          title: titleText.slice(0, 500),
          description: fullText,
          date: contestDate,
          publication_date: publicationDate,
          level: structured.level ?? levelFromCat ?? null,
          shift: structured.shift ?? null,
          schedule: structured.schedule ?? null,
          hours_to_cover: primaryItem.hoursToCover,
          school_id: school.id,
          subject_id: primaryItem.subjectId,
          source_url: normalizedUrl,
          source_name: SOURCE_NAME,
          is_active: true,
          is_processed: true,
        },
      });
      await tx.contestItem.createMany({
        data: resolvedItems.map((ri) => ({
          contest_id: contest.id,
          subject_id: ri.subjectId,
          hours_to_cover: ri.hoursToCover,
          item_type: ri.itemType,
        })),
      });
    });

    created++;
    existingUrlSet.add(normalizedUrl);

    cgeScraperLogger.info("CGE API scraper → concurso creado", {
      url: normalizedUrl,
      department: dep.name,
      level: structured.level ?? levelFromCat,
      items: resolvedItems.map((ri) => `${ri.itemType}:${ri.subjectName}(${ri.hoursToCover ?? "?"}hs)`),
    });

    // Pausa breve entre guardados para no saturar la DB ni la AI
    await new Promise((r) => setTimeout(r, 300));
  }

  appLogger.info("CGE API scraper finalizado", { created });
  cgeScraperLogger.info("CGE API scraper → finalizado", { created });
  return created;
}
