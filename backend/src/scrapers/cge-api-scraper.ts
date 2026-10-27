import type { PrismaClient } from "@prisma/client";
import axios from "axios";
import { appLogger, cgeScraperLogger } from "../lib/logger.js";
import {
  extractContestFieldsFromText,
  enrichContestFieldsWithAI,
} from "../services/contest-text-parser.js";
import { normalizeSubjectName, getItemType, getSubjectGroupName } from "../lib/subject-normalizer.js";
import { config, isEmailConfigured } from "../config.js";
import { emailNotifier } from "../infrastructure/email-notifier.js";
import { sendWhatsappMessage } from "../infrastructure/whatsapp-web-notifier.js";

async function notifyAdminCgeError(errorMsg: string): Promise<void> {
  const subject = "⚠️ Error en la API del CGE Entre Ríos";
  const body = `El scraper de concursos detectó un error al consultar la API del CGE:\n\n${errorMsg}\n\nFecha: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`;
  const html = `<p><strong>El scraper de concursos detectó un error al consultar la API del CGE:</strong></p><p>${errorMsg}</p><p>Fecha: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p>`;
  if (config.ADMIN_EMAIL && isEmailConfigured()) {
    await emailNotifier.send({ to: config.ADMIN_EMAIL, subject, html }).catch(() => {});
  }
  if (config.ADMIN_WHATSAPP) {
    await sendWhatsappMessage(config.ADMIN_WHATSAPP, `${subject}\n\n${body}`).catch(() => {});
  }
}

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

/** Categorías de nivel que nunca se piden a la API (exclusión de diseño, no hay post individual). */
export const LEVELS_SKIP: readonly string[] = ["Primaria", "Inicial"];

/**
 * Palabras clave que identifican niveles que no nos interesan (Primaria / Inicial).
 * Se aplican al título del post del catch-all, donde no hay categoría de nivel.
 */
export const SKIP_LEVEL_KEYWORDS: readonly string[] = [
  "primaria", "nivel primario", "nivel inicial", "inicial", "jardín", "jardin", "jardines",
];

/**
 * Departamentos y keywords para detectar departamento a partir de la URL del post.
 * Orden importa: gualeguaychu antes que gualeguay para evitar falsos positivos.
 */
const DEPARTMENT_CONFIGS: Array<{
  slug: string;
  name: string;
  keywords: string[];   // keywords en la URL del post (en minúsculas, sin acentos)
  textPatterns?: RegExp[]; // patrones en el texto del contenido del post
}> = [
  {
    slug: "islas-del-ibicuy",
    name: "Islas del Ibicuy",
    keywords: ["ibicuy", "ceibas", "paranacito", "mazaruca", "giorgi", "islas-del-ibicuy", "nep-nina"],
    textPatterns: [/\bibicuy\b/i, /\bvilla\s+paranacito\b/i, /\bceibas\b/i, /\bmazaruca\b/i, /dde\s+ibicuy/i],
  },
  {
    slug: "gualeguaychu",
    name: "Gualeguaychú",
    keywords: ["gualeguaychu"],
    textPatterns: [/\bgualeguaych[uú]\b/i, /dde\s+gualeguaych/i],
  },
  {
    slug: "gualeguay",
    name: "Gualeguay",
    keywords: ["gualeguay"],
    textPatterns: [/\bgualeguay\b/i, /dde\s+gualeguay\b/i, /\burdinarrain\b/i, /\blarroque\b/i],
  },
  {
    slug: "uruguay",
    name: "Uruguay",
    keywords: ["concepcion-del-uruguay", "colonia-elias", "colonia-larroque", "dde-uruguay"],
    textPatterns: [/\bconcepci[oó]n\s+del\s+uruguay\b/i, /dde\s+uruguay\b/i, /d\.d\.e\.?\s*uruguay\b/i, /\bcolonia\s+el[ií]as\b/i],
  },
  {
    slug: "parana",
    name: "Paraná",
    keywords: ["dptal-pna", "dde-parana", "dptal-parana", "crespo", "hasenkamp", "maria-grande"],
    textPatterns: [/dptal\.?\s*pn[áa]\.?/i, /dde\s+paran[áa]\b/i, /d\.d\.e\.?\s*paran[áa]\b/i, /\bcrespo\b/i, /\bhasenkamp\b/i, /\bmar[ií]a\s+grande\b/i],
  },
  {
    slug: "concordia",
    name: "Concordia",
    keywords: ["concordia", "dde-concordia", "yeruá", "nueva-escocesa"],
    textPatterns: [/dde\s+concordia\b/i, /d\.d\.e\.?\s*concordia\b/i, /[–\-]\s*concordia\b/i, /\bconcordia\b.*(?:concurs|llama|convoc)/i, /\byeruá\b/i, /\bnueva\s+escocesa\b/i],
  },
  {
    slug: "federacion",
    name: "Federación",
    keywords: ["chajairi", "chajar", "san-jaime", "dde-federacion", "nueva-escocesa-2"],
    textPatterns: [/dde\s+federaci[oó]n\b/i, /d\.d\.e\.?\s*federac\b/i, /\bchaj[aá]r[ií]\b/i, /\bsan\s+jaime\b/i],
  },
  {
    slug: "federal",
    name: "Federal",
    keywords: ["dde-federal", "sauce-de-luna"],
    textPatterns: [/dde\s+federal\b/i, /d\.d\.e\.?\s*federal\b/i, /\bsauce\s+de\s+luna\b/i],
  },
  {
    slug: "villaguay",
    name: "Villaguay",
    keywords: ["villaguay", "dde-villaguay", "aldea-san-antonio"],
    textPatterns: [/dde\s+villaguay\b/i, /d\.d\.e\.?\s*villaguay\b/i, /\bvillaguay\b/i, /\baldea\s+san\s+antonio\b/i],
  },
  {
    slug: "colon",
    name: "Colón",
    keywords: ["dde-colon", "villa-elisa", "puerto-yeruá", "san-jose-entre-rios"],
    textPatterns: [/dde\s+col[oó]n\b/i, /d\.d\.e\.?\s*col[oó]n\b/i, /\bvilla\s+elisa\b/i, /\bpuerto\s+yeru[aá]\b/i, /[–\-]\s*col[oó]n\b/i],
  },
  {
    slug: "san-salvador",
    name: "San Salvador",
    keywords: ["san-salvador", "general-campos", "ubajay", "san-gustavo"],
    textPatterns: [/\bsan\s+salvador\b/i, /dde\s+san\s+salv/i, /\bgeneral\s+campos\b/i, /\bubajay\b/i, /\bsan\s+gustavo\b/i],
  },
  {
    slug: "la-paz",
    name: "La Paz",
    keywords: ["dde-la-paz", "bovril", "santa-elena-entre-rios", "el-solar"],
    textPatterns: [/dde\s+la\s+paz\b/i, /d\.d\.e\.?\s*la\s+paz\b/i, /\bbovril\b/i, /\bsanta\s+elena\b.*entre\s+r[ií]os/i, /\bel\s+solar\b/i],
  },
  {
    slug: "nogoya",
    name: "Nogoyá",
    keywords: ["nogoya", "dde-nogoya", "aranguren", "villa-hernandez"],
    textPatterns: [/dde\s+nogoy[aá]\b/i, /\bnogoy[aá]\b/i, /\baranguren\b/i, /\bvilla\s+hern[aá]ndez\b/i],
  },
  {
    slug: "tala",
    name: "Tala",
    keywords: ["rosario-del-tala", "dde-tala", "macia", "villa-clara", "gobernador-mansilla"],
    textPatterns: [/dde\s+tala\b/i, /d\.d\.e\.?\s*tala\b/i, /\brosario\s+del\s+tala\b/i, /\bmaci[aá]\b/i, /\bgobernador\s+mansilla\b/i],
  },
  {
    slug: "diamante",
    name: "Diamante",
    keywords: ["dde-diamante"],
    textPatterns: [/dde\s+diamante\b/i, /d\.d\.e\.?\s*diamante\b/i, /[–\-]\s*diamante\b/i],
  },
  {
    slug: "victoria",
    name: "Victoria",
    keywords: ["dde-victoria"],
    textPatterns: [/dde\s+victoria\b/i, /d\.d\.e\.?\s*victoria\b/i, /[–\-]\s*victoria\b/i],
  },
  {
    slug: "feliciano",
    name: "Feliciano",
    keywords: ["feliciano", "san-jose-de-feliciano"],
    textPatterns: [/dde\s+feliciano\b/i, /d\.d\.e\.?\s*feliciano\b/i, /\bsan\s+jos[eé]\s+de\s+feliciano\b/i],
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
    // Entidades numéricas comunes en posts del CGE (WordPress las genera para guiones y comillas tipográficas)
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      // Guiones tipográficos → guión simple para que el parser los reconozca como bullets
      if (n === 8211 || n === 8212) return "-";
      // Comillas tipográficas → comillas ASCII
      if (n === 8220 || n === 8221 || n === 8216 || n === 8217) return '"';
      // Resto de entidades numéricas → espacio para no romper el texto
      return " ";
    })
    // Colapsar espacios/tabs repetidos SIN tocar los \n (que marcan párrafos).
    // Antes esto era `.replace(/\s{2,}/g, " ")`, que también colapsaba \n adyacentes
    // a espacios (típico en HTML indentado) y fusionaba todos los párrafos en una
    // sola línea, rompiendo el parseo por línea de extractContestFieldsFromText.
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n")
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

/** Detecta el departamento a partir del contenido de texto del post (fallback cuando la URL no tiene keywords). */
function detectDepartmentFromContent(text: string): { slug: string; name: string } | null {
  for (const dep of DEPARTMENT_CONFIGS) {
    if (dep.textPatterns?.some((re) => re.test(text))) {
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
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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
      // Enriquecer el error con el status HTTP para que el caller pueda loguear el código
      const enriched = new Error(`HTTP ${status ?? "sin respuesta"}: ${(err as Error).message}`);
      (enriched as { httpStatus?: number }).httpStatus = status;
      throw enriched;
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

export async function runCgeApiScraper(
  prisma: PrismaClient,
  schedulerRunId?: number,
): Promise<{ created: number; fetched: number }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  // Ventana: últimos 10 días (00:00:00 hasta ahora)
  const tenDaysAgo = new Date(now);
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  tenDaysAgo.setHours(0, 0, 0, 0);
  const afterDate = tenDaysAgo.toISOString().slice(0, 19);
  const beforeDate = now.toISOString().slice(0, 19);

  appLogger.info("Iniciando CGE API scraper", { afterDate, beforeDate });
  cgeScraperLogger.info("CGE API scraper → inicio", { afterDate, beforeDate });

  // Obtener URLs ya guardadas en los últimos 30 días (misma ventana que el scraper)
  const existingContests = await prisma.contest.findMany({
    where: { source_name: SOURCE_NAME, created_at: { gte: tenDaysAgo } },
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
      created_at: { gte: tenDaysAgo },
      source_url: { contains: "cge.entrerios.gov.ar/" },
    },
    select: { source_url: true },
  });
  for (const c of existingAllSources) {
    if (c.source_url) existingUrlSet.add(c.source_url.replace(/\/$/, ""));
  }

  // Recolectar todos los posts del mes agrupados por nivel
  const allPosts = new Map<string, WpPost>(); // key = URL normalizada

  const levelsSkipSet = new Set(LEVELS_SKIP);
  let apiSuccessCount = 0;
  let apiErrorCount = 0;

  for (const levelCat of LEVEL_CATEGORIES) {
    if (levelsSkipSet.has(levelCat.level)) {
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
      const httpStatus = (err as { httpStatus?: number }).httpStatus;
      cgeScraperLogger.warn("CGE API scraper → error al obtener categoría", {
        level: levelCat.level,
        httpStatus,
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
      allPosts.set(normalized, post);
    }

    // Pausa entre categorías para no saturar la API
    await new Promise((r) => setTimeout(r, 500));
  }

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
            scheduler_run_id: schedulerRunId ?? null,
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

  // Si todas las categorías fallaron, la API está caída — notificamos y lanzamos para activar fallback
  if (apiSuccessCount === 0 && apiErrorCount > 0) {
    const errMsg = `La API del CGE (${WP_API}) no respondió correctamente en ninguna de las ${apiErrorCount} categorías consultadas. Posible 503 u otro error de servidor.`;
    cgeScraperLogger.warn("CGE API scraper → todas las categorías fallaron, API no disponible", { apiErrorCount });
    await notifyAdminCgeError(errMsg);
    throw new CgeApiUnavailableError(errMsg);
  }

  cgeScraperLogger.info("CGE API scraper → posts relevantes encontrados", {
    total: allPosts.size,
    apiSuccessCount,
    apiErrorCount,
  });

  let created = 0;

  // Cache en memoria para evitar N+1 queries de departments y subjects durante el loop.
  // Departments son un conjunto fijo (~17); subjects crecen lentamente.
  const departmentCache = new Map<string, { id: number; name: string }>();
  const subjectCache = new Map<string, number>(); // name → id

  // Pre-cargar todos los departments y subjects existentes de una sola vez
  const allDepartments = await prisma.department.findMany({ select: { id: true, name: true, slug: true } });
  for (const d of allDepartments) {
    departmentCache.set(d.slug, { id: d.id, name: d.name });
    departmentCache.set(d.name, { id: d.id, name: d.name });
  }
  const allSubjects = await prisma.subject.findMany({ select: { id: true, name: true } });
  for (const s of allSubjects) subjectCache.set(s.name, s.id);

  for (const [normalizedUrl, post] of allPosts.entries()) {
    if (existingUrlSet.has(normalizedUrl)) {
      cgeScraperLogger.info("CGE API scraper → ya existe, se omite", { url: normalizedUrl });
      await prisma.discardedPost.create({
        data: {
          source_name: SOURCE_NAME,
          url: normalizedUrl,
          title: post.title?.rendered ?? "",
          reason: "duplicate_url",
          keyword_matched: null,
          post_date: post.date ? new Date(post.date) : null,
          scheduler_run_id: schedulerRunId ?? null,
        },
      }).catch(() => {
        // Si falla (ej. url muy larga) seguimos sin interrumpir el scraping
      });
      continue;
    }

    const titleText = htmlToText(post.title?.rendered ?? "");
    const contentText = htmlToText(post.content?.rendered ?? "");
    const fullText = [titleText, contentText].filter(Boolean).join("\n\n");

    const levelFromCat = detectLevel(post.categories);
    let dep = detectDepartment(normalizedUrl) ?? detectDepartmentFromContent(fullText);

    // Tercer fallback: buscar CUE en el texto y consultar el padrón oficial
    if (!dep) {
      const { extractCueFromText, lookupCue } = await import("../services/padron-escuelas.service.js");
      const cue = extractCueFromText(fullText);
      if (cue) {
        const padron = await lookupCue(prisma, cue);
        if (padron) {
          dep = { slug: padron.departamento.toLowerCase().replace(/\s+/g, "-").replace(/[áä]/g,"a").replace(/[éë]/g,"e").replace(/[íï]/g,"i").replace(/[óö]/g,"o").replace(/[úü]/g,"u"), name: padron.departamento };
        }
      }
    }

    dep = dep ?? { slug: "sin-departamento", name: "Sin departamento" };

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

    // Enriquecer con AI solo cuando algún item del regex no mapea a materia conocida.
    // Si todos normalizan, el regex fue suficiente y ahorramos créditos de la API.
    const allItemsKnown = regexFields.items.length > 0 &&
      regexFields.items.every((item) => item.subjectName && normalizeSubjectName(item.subjectName) !== undefined);
    const structured = allItemsKnown
      ? regexFields
      : await enrichContestFieldsWithAI(regexFields, fullText);

    // publication_date: siempre la fecha real del post en la API de WordPress
    const publicationDate = publishedAt;
    // contest_date: fecha del concurso extraída del contenido del post; si no se encuentra, usamos publication_date como fallback
    const contestDate = structured.contestDate ?? publicationDate;

    // Resolver o crear departamento: preferir el departamento extraído por la IA sobre el detectado por URL
    const aiDeptName = structured.department?.trim();
    let resolvedDep = dep; // fallback: lo detectado por URL (puede ser "Sin departamento")
    if (aiDeptName) {
      const aiSlug = aiDeptName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
      const cached = departmentCache.get(aiSlug) ?? departmentCache.get(aiDeptName);
      if (cached) {
        resolvedDep = { slug: aiSlug, name: cached.name };
      } else {
        // Buscar en BD por nombre (fuzzy: contains)
        const found = await prisma.department.findFirst({ where: { name: { contains: aiDeptName } } });
        if (found) {
          resolvedDep = { slug: found.name.toLowerCase().replace(/\s+/g, "-"), name: found.name };
          departmentCache.set(resolvedDep.slug, { id: found.id, name: found.name });
          departmentCache.set(found.name, { id: found.id, name: found.name });
        } else {
          resolvedDep = { slug: aiSlug, name: aiDeptName };
        }
      }
    }

    const canonicalName = resolvedDep.name;
    let departmentEntry = departmentCache.get(resolvedDep.slug) ?? departmentCache.get(canonicalName);
    if (!departmentEntry) {
      const created = await prisma.department.create({ data: { name: canonicalName, slug: resolvedDep.slug } });
      departmentEntry = { id: created.id, name: created.name };
      departmentCache.set(resolvedDep.slug, departmentEntry);
      departmentCache.set(canonicalName, departmentEntry);
    }
    const department = departmentEntry;

    // Resolver o crear escuela: usamos nombre de la IA si está disponible, y ciudad de la IA.
    const aiCity = structured.city?.trim() || canonicalName;
    const schoolName = structured.schoolName?.trim().slice(0, 255) || `CGE ${canonicalName}`;
    let school = await prisma.school.findFirst({
      where: { name: schoolName, department_id: department.id },
    });
    if (!school) {
      school = await prisma.school.create({
        data: {
          name: schoolName,
          city: aiCity,
          department: canonicalName,
          department_id: department.id,
        },
      });
    } else if (school.city === canonicalName && aiCity !== canonicalName) {
      // Si la escuela ya existía con ciudad = departamento (fallback), actualizar con la ciudad real
      await prisma.school.update({ where: { id: school.id }, data: { city: aiCity } });
    }

    // Resolver subjects para todos los items extraídos (cache: evita query por item)
    const resolvedItems: {
      subjectName: string; subjectId: number; hoursToCover: number | null;
      itemType: string; grade: string | null; llamado: string | null; caracter: string | null;
    }[] = [];
    for (const item of structured.items) {
      const subjectName = (normalizeSubjectName(item.subjectName) ?? item.subjectName ?? "General").slice(0, 255);
      let subjectId = subjectCache.get(subjectName);
      if (subjectId === undefined) {
        const normalizedGroup = getSubjectGroupName(subjectName).slice(0, 100);
        const upserted = await prisma.subject.upsert({
          where: { name: subjectName },
          create: { name: subjectName, normalized_name: normalizedGroup },
          update: { normalized_name: normalizedGroup },
        });
        subjectId = upserted.id;
        subjectCache.set(subjectName, subjectId);
      }
      resolvedItems.push({
        subjectName, subjectId,
        hoursToCover: item.hoursToCover ?? null,
        itemType: getItemType(subjectName),
        grade: item.grade?.slice(0, 80) ?? null,
        llamado: item.llamado?.slice(0, 60) ?? null,
        caracter: item.caracter?.slice(0, 100) ?? null,
      });
    }

    // Fallback si la extracción no encontró ningún item
    if (resolvedItems.length === 0) {
      const fallbackName = "General";
      let subjectId = subjectCache.get(fallbackName);
      if (subjectId === undefined) {
        const upserted = await prisma.subject.upsert({ where: { name: fallbackName }, create: { name: fallbackName }, update: {} });
        subjectId = upserted.id;
        subjectCache.set(fallbackName, subjectId);
      }
      resolvedItems.push({ subjectName: fallbackName, subjectId, hoursToCover: null, itemType: "materia", grade: null, llamado: null, caracter: null });
    }

    // Crear UN concurso + N ContestItems en transacción
    const primaryItem = resolvedItems[0];

    // Detectar si es ampliatoria de un concurso previo de la misma escuela (últimos 30 días)
    const isAmpliatoria = /ampliatoria|rectificaci[oó]n|modificaci[oó]n|correccion/i.test(titleText);
    let parentContestId: number | null = null;
    if (isAmpliatoria) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
      const parent = await prisma.contest.findFirst({
        where: {
          school_id: school.id,
          created_at: { gte: thirtyDaysAgo },
          subject_id: primaryItem.subjectId,
          parent_contest_id: null,
          title: { not: { contains: "ampliatoria" } },
        },
        orderBy: { created_at: "desc" },
      });
      if (parent) {
        parentContestId = parent.id;
        cgeScraperLogger.info("CGE API scraper → ampliatoria vinculada a concurso padre", {
          childUrl: normalizedUrl,
          parentId: parent.id,
          parentTitle: parent.title,
        });
      }
    }
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
          parent_contest_id: parentContestId,
        },
      });
      await tx.contestItem.createMany({
        data: resolvedItems.map((ri) => ({
          contest_id: contest.id,
          subject_id: ri.subjectId,
          hours_to_cover: ri.hoursToCover,
          grade: ri.grade,
          llamado: ri.llamado,
          caracter: ri.caracter,
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

  appLogger.info("CGE API scraper finalizado", { created, fetched: allPosts.size });
  cgeScraperLogger.info("CGE API scraper → finalizado", { created, fetched: allPosts.size });
  return { created, fetched: allPosts.size };
}
