import type { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import axios from "axios";
import path from "path";
import { appLogger, facebookScraperLogger } from "../lib/logger.js";
import { extractContestFieldsFromText } from "../services/contest-text-parser.js";

const SOURCE_NAME = "Facebook CGE Entre Ríos";
const TOR_PROXY_URL = process.env.TOR_PROXY_URL || "socks5://127.0.0.1:9050";

function isTorProxyError(error: unknown): boolean {
  const message = (error as Error)?.message?.toLowerCase?.() ?? "";
  return (
    message.includes("err_socks_connection_failed") ||
    message.includes("err_proxy_connection_failed") ||
    message.includes("socks") ||
    message.includes("proxy")
  );
}

async function createBrowserWithoutProxy(): Promise<{ browser: Browser; facebookContextUsesTor: boolean }> {
  const context = await chromium.launchPersistentContext(FB_USER_DATA_DIR, {
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  facebookScraperLogger.info("Facebook scraper → browser started without Tor proxy", {
    facebook_context_uses_tor: false,
  });
  // @ts-expect-error – adaptamos BrowserContext a la interfaz mínima usada.
  return { browser: context, facebookContextUsesTor: false };
}

/**
 * Página de Facebook + departamento al que se asocian los concursos creados.
 * El feed puede enlazar convocatorias de varias zonas, pero el canal es de una DDE concreta:
 * conviene usar el mismo departamento que en CGE (slug/name) para que los filtros en la app coincidan.
 */
export type FacebookCgePageConfig = {
  pageUrl: string;
  departmentSlug: string;
  departmentName: string;
};

const FACEBOOK_PAGES: FacebookCgePageConfig[] = [
  {
    pageUrl: "https://www.facebook.com/ddeislasdelibicuy",
    departmentSlug: "islas-del-ibicuy",
    departmentName: "Islas del Ibicuy",
  },
];

// Directorio de perfil persistente para mantener sesión de Facebook entre ejecuciones.
const FB_USER_DATA_DIR = path.join(process.cwd(), ".playwright-facebook-profile");

/** Script del feed: .js plano para page.evaluate(string) — tsx no debe transpilarlo (evita __name). */
let facebookFeedCollectScript: string | null = null;

function getFacebookFeedCollectScript(): string {
  if (facebookFeedCollectScript) return facebookFeedCollectScript;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "facebook-cge-feed-collect.browser.js"),
    path.join(process.cwd(), "src/scrapers/facebook-cge-feed-collect.browser.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      facebookFeedCollectScript = readFileSync(candidate, "utf8");
      return facebookFeedCollectScript;
    }
  }
  throw new Error(
    "Falta facebook-cge-feed-collect.browser.js junto al scraper o en src/scrapers (tras build: copiar a dist/scrapers).",
  );
}

interface FacebookPost {
  pageUrl: string;
  postUrl: string;
  text: string;
  createdAt?: Date;
  /** Último link a CGE encontrado dentro del post (si existe). */
  cgeUrl?: string;
  /**
   * true cuando el post fue generado por DB-seed (extrapolación desde URLs ya conocidas).
   * Estos candidatos solo se guardan si el enriquecimiento confirma que la URL existe en CGE.
   */
  dbSeedCandidate?: boolean;
}

/** Solo `https://cge.entrerios.gov.ar/AAAA/MM/...` con año y mes actuales (reloj del servidor). */
function isCgeUrlCurrentYearMonth(url: string): boolean {
  try {
    const u = new URL(String(url).trim());
    if (!u.hostname.toLowerCase().includes("cge.entrerios.gov.ar")) return false;
    const m = u.pathname.match(/\/(\d{4})\/(\d{2})\//);
    if (!m) return false;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = new Date();
    return y === d.getFullYear() && mo === d.getMonth() + 1;
  } catch {
    return false;
  }
}

async function createBrowser(): Promise<{ browser: Browser; facebookContextUsesTor: boolean }> {
  // Usamos perfil persistente para que el usuario pueda iniciar sesión una sola vez.
  try {
    const context = await chromium.launchPersistentContext(FB_USER_DATA_DIR, {
      headless: false,
      proxy: { server: TOR_PROXY_URL },
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    facebookScraperLogger.info("Facebook scraper → browser started with Tor proxy", {
      proxy: TOR_PROXY_URL,
      facebook_context_uses_tor: true,
    });
    // Compatibilizamos el tipo Browser usando el propio contexto, que expone newPage/close.
    // @ts-expect-error – adaptamos BrowserContext a la interfaz mínima usada.
    return { browser: context, facebookContextUsesTor: true };
  } catch (error) {
    if (!isTorProxyError(error)) throw error;

    facebookScraperLogger.warn("Facebook scraper → Tor proxy unavailable, retrying without proxy", {
      proxy: TOR_PROXY_URL,
      error: (error as Error)?.message ?? String(error),
    });
    return createBrowserWithoutProxy();
  }
}

async function ensureLoggedIn(page: Page, pageUrl: string) {
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  // Si el usuario ya está logueado, Facebook redirige directamente al feed.
  // Si no, mostrará login; en ese caso el humano debe iniciar sesión manualmente una vez.
  facebookScraperLogger.info("Facebook page cargada para scraping", { url: pageUrl });

  // Damos un tiempo breve para iniciar sesión manualmente (si hace falta).
  await page.waitForTimeout(10000);

  const loginState = await page.evaluate(function () {
    const hasPasswordInput = !!document.querySelector("input[type='password']");
    const loginLikeButton = Array.from(document.querySelectorAll("button, a"))
      .some((el) => /inicia sesi[oó]n|log in|iniciar sesi[oó]n/i.test((el.textContent || "").trim()));
    return { hasPasswordInput, loginLikeButton, title: document.title };
  });

  if (loginState.hasPasswordInput || loginState.loginLikeButton) {
    facebookScraperLogger.warn("Facebook scraper → posible sesión no autenticada", loginState);
  } else {
    facebookScraperLogger.info("Facebook scraper → sesión aparentemente autenticada", loginState);
  }
}

async function scrollAndCollectPosts(page: Page, maxPosts: number): Promise<FacebookPost[]> {
  const posts: FacebookPost[] = [];
  await page.evaluate(function () {
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800 + Math.random() * 400);

  let lastHeight = await page.evaluate(function () {
    return document.body.scrollHeight;
  });
  let stableHeightIterations = 0;
  let iteration = 0;
  const minScrollIterations = 5;
  const maxScrollIterations = 10;

  /**
   * Reutilizable: escanea con Playwright los anchors directos al CGE visibles en el DOM actual.
   * Se llama antes del loop Y dentro de cada iteración.
   */
  const scanCgeAnchorsNative = async (currentIteration: number) => {
    if (posts.length >= maxPosts) return;
    const nativeCgeLinks = await page
      .$$eval(
        'a[href*="cge.entrerios.gov.ar"], a[href*="cge%2Eentrerios"]',
        (anchors: Element[]) =>
          (anchors as HTMLAnchorElement[]).map((a) => {
            const href = a.href || a.getAttribute("href") || "";
            const postRoot = a.closest(
              'article, [role="article"], div[data-ad-rendering-role="image"], div[data-ad-rendering-role="story_message"]',
            ) as HTMLElement | null;
            const text = postRoot?.innerText?.trim() || a.innerText?.trim() || "";
            return { href, text };
          }),
      )
      .catch(() => [] as { href: string; text: string }[]);

    for (const link of nativeCgeLinks) {
      if (!link.href) continue;
      try {
        const u = new URL(link.href);
        if (!u.hostname.toLowerCase().includes("cge.entrerios.gov.ar")) continue;
        const pth = u.pathname.toLowerCase();
        if (!/\/\d{4}\/\d{2}\//.test(pth)) continue;
        if (pth.includes("/wp-content/") || pth.includes("/noticias/")) continue;
        if (!/(concurso|convocatoria|cargo|oposicion|llamado)/.test(pth)) continue;
        if (!isCgeUrlCurrentYearMonth(link.href)) continue;
        u.search = "";
        u.hash = "";
        const normalized = u.toString().replace(/\/$/, "");
        if (posts.find((p) => p.postUrl === normalized || p.cgeUrl === normalized)) continue;
        facebookScraperLogger.info("Facebook scraper → link CGE detectado via Playwright nativo", {
          normalized,
          iteration: currentIteration,
        });
        posts.push({
          pageUrl: page.url(),
          postUrl: normalized,
          text: link.text || "Facebook post (direct CGE link)",
          cgeUrl: normalized,
        });
        if (posts.length >= maxPosts) break;
      } catch {
        // URL inválida, ignorar
      }
    }
  };

  // Scan inicial: capturar links CGE ya visibles antes de cualquier scroll
  await scanCgeAnchorsNative(0);

  while (posts.length < maxPosts && iteration < maxScrollIterations) {
    iteration += 1;
    await page.waitForTimeout(2200 + Math.random() * 2200);

    // Pequeño diagnóstico para entender qué ve realmente el navegador.
    const diag = await page.evaluate(function () {
      const postNodes = document.querySelectorAll(
        "article, div[role='article'], div.html-div, div[data-ad-preview='message'], div[data-ad-rendering-role='story_message']",
      );
      // No usar href^='http': Facebook suele poner rutas relativas (/l.php?u=...); a.href igual resuelve absoluta.
      const anchors = document.querySelectorAll("a[href]");
      const cgeDirect = document.querySelectorAll("a[href*='cge.entrerios.gov.ar']").length;
      /** Cualquier l.php (href absoluto o relativo); el DOM a veces no usa el mismo string que antes. */
      const cgeViaRedirect = document.querySelectorAll('a[href*="l.php"]').length;
      return { postCount: postNodes.length, anchorCount: anchors.length, cgeDirect, cgeViaRedirect };
    });

    facebookScraperLogger.debug("Facebook scraper → diagnóstico de DOM", {
      postCount: diag.postCount,
      anchorCount: diag.anchorCount,
      cgeDirect: diag.cgeDirect,
      cgeViaRedirect: diag.cgeViaRedirect,
      iteration,
    });

    // Logueamos una muestra de los primeros posts para entender mejor su estructura.
    if (posts.length === 0) {
      const sample = await page.evaluate(function () {
        const postNodes = Array.from(
          document.querySelectorAll(
            "article, div[role='article'], div.html-div, div[data-ad-preview='message'], div[data-ad-rendering-role='story_message']",
          ),
        ) as HTMLElement[];

        return postNodes.slice(0, 3).map(function (post, idx) {
          const text = post.innerText?.trim() ?? "";
          const anchors = Array.from(post.querySelectorAll("a[href]")) as HTMLAnchorElement[];

          const hrefs = anchors.map(function (a) {
            return a.href;
          }).filter(Boolean);

          return {
            idx,
            textPreview: text.slice(0, 200),
            hrefs,
            hrefCount: hrefs.length,
          };
        });
      });

      facebookScraperLogger.debug("Facebook scraper → muestra de posts iniciales", {
        sample,
      });
    }

    type FeedCollectEval =
      | Array<{
          postUrl: string;
          text: string;
          cgeUrl?: string;
        }>
      | {
          posts: Array<{
            postUrl: string;
            text: string;
            cgeUrl?: string;
          }>;
          /** Métricas y muestras del HTML (script del navegador). */
          diag: Record<string, unknown>;
        };

    const feedEval = (await page.evaluate(getFacebookFeedCollectScript())) as FeedCollectEval;
    const newPosts = Array.isArray(feedEval) ? feedEval : feedEval.posts;
    if (!Array.isArray(feedEval)) {
      facebookScraperLogger.debug("Facebook scraper → feed collect HTML/diag", {
        iteration,
        ...feedEval.diag,
      });
    }

    let nuevosEnBatch = 0;
    let repetidosEnBatch = 0;
    for (const p of newPosts) {
      const duplicated = !!posts.find((x) => x.postUrl === p.postUrl);
      if (duplicated) {
        repetidosEnBatch += 1;
        continue;
      }
      nuevosEnBatch += 1;
      // Un link alcanza con loguearlo una sola vez (la primera vez que lo vemos).
      facebookScraperLogger.debug("Facebook scraper → nuevo link CGE en feed", {
        postUrl: p.postUrl,
        hasText: !!p.text,
        hasCgeUrl: !!p.cgeUrl,
      });
      posts.push({
        pageUrl: page.url(),
        postUrl: p.postUrl,
        text: p.text,
        cgeUrl: p.cgeUrl,
      });
      if (posts.length >= maxPosts) break;
    }

    facebookScraperLogger.debug("Facebook scraper → resumen batch scroll", {
      batchSize: newPosts.length,
      nuevosEnBatch,
      repetidosSaltados: repetidosEnBatch,
      totalAcumulado: posts.length,
      iteration,
    });

    await page.evaluate(function () {
      var h = window.innerHeight || 600;
      window.scrollBy(0, Math.max(320, Math.floor(h * 0.72)));
    });
    await page.waitForTimeout(1800 + Math.random() * 1600);
    /** De vez en cuando al final del documento para virtualización; pocas veces para no ir "muy abajo". */
    if (iteration % 5 === 0 && iteration <= 15) {
      await page.evaluate(function () {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(1400 + Math.random() * 900);
    }

    // Playwright-native fallback: capturar anchors directos al CGE en el DOM actual
    await scanCgeAnchorsNative(iteration);

    const newHeight = await page.evaluate(function () {
      return document.body.scrollHeight;
    });
    if (newHeight === lastHeight) {
      stableHeightIterations += 1;
      if (iteration >= minScrollIterations && stableHeightIterations >= 3) break;
    } else {
      stableHeightIterations = 0;
    }
    lastHeight = newHeight;
  }

  return posts;
}

function isCgeHostUrl(url: string): boolean {
  return /cge\.entrerios\.gov\.ar/i.test(url);
}

/** Extrae texto y mejor link CGE desde la página ya cargada (post de Facebook o nota del CGE). */
async function extractPostDetailFromPage(detailPage: Page): Promise<{ text: string; cgeUrl?: string }> {
  return detailPage.evaluate(function () {
    const host = window.location.hostname.toLowerCase();
    const onCgeSite = host.includes("cge.entrerios.gov.ar");

    // --- Nota individual del CGE: mismo criterio que cge-scraper (.texto p). ---
    if (onCgeSite) {
      const parts: string[] = [];
      for (const node of document.querySelectorAll(".texto p")) {
        const t = (node as HTMLElement).innerText?.trim();
        if (t) parts.push(t);
      }
      if (parts.length === 0) {
        for (const node of document.querySelectorAll(".entry-content p, .post-content p, article p")) {
          const t = (node as HTMLElement).innerText?.trim();
          if (t && t.length > 2) parts.push(t);
        }
      }
      if (parts.length === 0) {
        const textoBlock = document.querySelector(".texto") as HTMLElement | null;
        const t = textoBlock?.innerText?.trim();
        if (t && t.length > 20) parts.push(t);
      }

      let fullText = parts.join("\n\n").trim();
      const h1El = document.querySelector("h1.entry-title, article h1, .entry-header h1, h1");
      const h1 = h1El?.textContent?.trim() ?? "";
      if (h1) {
        const h1Short = h1.toLowerCase().slice(0, Math.min(48, h1.length));
        if (!h1Short || !fullText.toLowerCase().includes(h1Short)) {
          fullText = fullText ? `${h1}\n\n${fullText}` : h1;
        }
      }

      if (fullText.length < 80) {
        const og = document
          .querySelector('meta[property="og:description"]')
          ?.getAttribute("content")
          ?.trim();
        if (og) fullText = fullText ? `${fullText}\n\n${og}` : og;
      }

      if (fullText.length < 60) {
        const candidates = [
          document.querySelector('[role="main"]'),
          document.querySelector("main .content, #content, .site-content"),
          document.querySelector("main"),
          document.querySelector("article"),
          document.body,
        ].filter(Boolean) as HTMLElement[];
        let best = "";
        for (const c of candidates) {
          const t = c.innerText?.trim() ?? "";
          if (t.length > best.length) best = t;
        }
        if (best.length > fullText.length) fullText = best;
      }

      let pageCgeUrl: string | undefined;
      try {
        const hrefCanon =
          document.querySelector("link[rel='canonical']")?.getAttribute("href") || window.location.href;
        const u = new URL(hrefCanon, window.location.origin);
        if (u.hostname.toLowerCase().includes("cge.entrerios.gov.ar")) {
          u.search = "";
          u.hash = "";
          pageCgeUrl = u.toString().replace(/\/$/, "");
        }
      } catch {
        pageCgeUrl = undefined;
      }

      return { text: fullText, cgeUrl: pageCgeUrl };
    }

    // --- Facebook u otra página: buscar artículo / post y links al CGE. ---
    const containers = [
      document.querySelector("article"),
      document.querySelector("div[role='article']"),
      document.querySelector('[role="main"]'),
      document.querySelector("main"),
      document.body,
    ].filter(Boolean) as HTMLElement[];

    let fullText = "";
    for (const c of containers) {
      const t = c.innerText?.trim() ?? "";
      if (t.length > fullText.length) fullText = t;
    }

    let bestCgeLink: string | undefined;
    let bestScore = -Infinity;

    /** Igual que facebook-cge-feed-collect: l.facebook.com/l.php?u=https%3A%2F%2Fcge... (cadena + doble decode). */
    function unwrapFbOutboundHref(rawHref: string): string {
      let out = String(rawHref).trim();
      for (let iter = 0; iter < 6; iter++) {
        try {
          const url = new URL(out);
          const h = url.hostname.toLowerCase();
          const isFbHost =
            h.includes("facebook.com") || h.includes("fb.com") || h.includes("fbcdn.net");
          if (!isFbHost) break;
          const uParam =
            url.searchParams.get("u") ||
            url.searchParams.get("url") ||
            url.searchParams.get("href") ||
            url.searchParams.get("target_url");
          if (!uParam) break;
          let next = String(uParam).replace(/\+/g, " ");
          for (let decPass = 0; decPass < 5 && /%[0-9A-Fa-f]{2}/.test(next); decPass++) {
            try {
              const prevN = next;
              next = decodeURIComponent(next);
              if (next === prevN) break;
            } catch {
              break;
            }
          }
          if (next === out) break;
          out = next;
        } catch {
          return rawHref;
        }
      }
      return out;
    }

    const anchors = Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[];
    for (const a of anchors) {
      let href = a.href || "";
      if (!href) continue;
      href = unwrapFbOutboundHref(href);

      if (!href.toLowerCase().includes("cge.entrerios.gov.ar")) continue;

      try {
        const url = new URL(href);
        const path = url.pathname.toLowerCase();
        const isMedia = path.includes("/wp-content/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
        if (isMedia) continue;
        if (path.includes("/noticias/") || path.includes("noticias")) continue;
        if (path.includes("feriadecarrerasyoficios")) continue;

        const looksLikeContest =
          path.includes("concurso") ||
          path.includes("oposicion") ||
          path.includes("oposición") ||
          path.includes("convocatoria") ||
          path.includes("llamado") ||
          path.includes("cargo");
        if (!looksLikeContest) continue;

        let score = 0;
        if (path.includes("convocatoria-concurso")) score += 60;
        if (path.includes("llamado-a-concurso")) score += 50;
        if (path.includes("escuela")) score += 5;
        if (path.includes("secundaria")) score += 5;
        if (/\/\d{4}\/\d{2}\//.test(path)) score += 10;

        if (score > bestScore) {
          bestScore = score;
          url.search = "";
          url.hash = "";
          bestCgeLink = url.toString().replace(/\/$/, "");
        }
      } catch {
        // ignore invalid href
      }
    }

    return { text: fullText, cgeUrl: bestCgeLink };
  });
}

const ENRICH_GOTO_TIMEOUT_MS = 90_000;

/**
 * Visita el post individual para extraer texto completo y, si falta, el link al CGE.
 * Las URLs del sitio CGE se intentan vía Tor (contexto de Facebook o navegador efímero).
 */
async function enrichPostFromDetails(
  browser: Browser,
  post: FacebookPost,
  facebookContextUsesTor: boolean,
): Promise<FacebookPost> {
  const url = post.postUrl;
  const targetIsCge = isCgeHostUrl(url);
  const viewport = { width: 1280, height: 720 };
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const torRequested = targetIsCge || facebookContextUsesTor;

  const visitAndExtract = async (
    detailPage: Page,
    torUsed: boolean,
    torFallbackToDirect: boolean,
  ) => {
    facebookScraperLogger.info("Facebook scraper → visitando post individual", {
      url,
      tor_requested: torRequested,
      tor_used: torUsed,
      tor_fallback_to_direct: torFallbackToDirect,
    });
    detailPage.setDefaultTimeout(ENRICH_GOTO_TIMEOUT_MS);
    detailPage.setDefaultNavigationTimeout(ENRICH_GOTO_TIMEOUT_MS);
    try {
      // networkidle suele fallar por timeout detrás de Tor; domcontentloaded es más estable.
      await detailPage.goto(url, { waitUntil: "domcontentloaded", timeout: ENRICH_GOTO_TIMEOUT_MS });
      if (isCgeHostUrl(url)) {
        // Verificación rápida: CGE responde HTTP 200 con "La página solicitada está en construcción"
        // cuando la URL no existe. Si ya aparece ese texto tras domcontentloaded, no esperamos más.
        const quickText = await detailPage
          .evaluate(() => (document.body?.innerText ?? "").slice(0, 400))
          .catch(() => "");
        const isQuickJunk =
          /p[aá]gina solicitada est[aá] en construcci[oó]n/i.test(quickText) ||
          /p[aá]gina no encontrada/i.test(quickText) ||
          /error 404/i.test(quickText) ||
          (/gobierno de entre r[ií]os/i.test(quickText) && quickText.trim().length < 200);

        if (!isQuickJunk) {
          // El contenido real de la nota puede llegar levemente después (fuentes/AJAX).
          await detailPage
            .waitForSelector(".texto p, .texto, .entry-content, article .entry-content", {
              timeout: 12_000,
            })
            .catch(() => undefined);
        }
      }
      const { text, cgeUrl } = await extractPostDetailFromPage(detailPage);
      const prev = (post.text ?? "").trim();
      const looksPlaceholder =
        prev.length === 0 || /^Facebook post\b/i.test(prev) || prev.length < 60;
      // No sobreescribir con contenido de error del CGE ("en construccion", etc.)
      const newTextIsJunk =
        /p[aá]gina solicitada est[aá] en construcci[oó]n/i.test(text) ||
        (/gobierno de entre r[ií]os/i.test(text) && text.trim().length < 120);
      if (
        text &&
        text.trim().length > 0 &&
        !newTextIsJunk &&
        (looksPlaceholder || text.trim().length >= prev.length)
      ) {
        post.text = text;
      }
      if (cgeUrl) post.cgeUrl = cgeUrl;
    } finally {
      await detailPage.close().catch(() => undefined);
    }
  };

  try {
    if (targetIsCge && facebookContextUsesTor) {
      const detailPage = await browser.newPage({ userAgent, viewport });
      await visitAndExtract(detailPage, true, false);
    } else if (targetIsCge && !facebookContextUsesTor) {
      let torBrowser: Browser | null = null;
      try {
        torBrowser = await chromium.launch({
          headless: true,
          proxy: { server: TOR_PROXY_URL },
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });
        const detailPage = await torBrowser.newPage({ userAgent, viewport });
        await visitAndExtract(detailPage, true, false);
      } catch (err) {
        if (!isTorProxyError(err)) throw err;
        facebookScraperLogger.warn("Facebook scraper → CGE enrich: Tor no disponible, visita directa", {
          url,
          error: (err as Error)?.message ?? String(err),
        });
        const detailPage = await browser.newPage({ userAgent, viewport });
        await visitAndExtract(detailPage, false, true);
      } finally {
        if (torBrowser) {
          await torBrowser.close().catch(() => undefined);
        }
      }
    } else {
      const detailPage = await browser.newPage({ userAgent, viewport });
      await visitAndExtract(detailPage, facebookContextUsesTor, false);
    }
  } catch (err) {
    facebookScraperLogger.warn("Facebook CGE scraper → fallo al enriquecer post", {
      url: post.postUrl,
      tor_requested: torRequested,
      error: (err as Error)?.message ?? String(err),
    });
  }

  return post;
}

/**
 * Genera candidatos de URL para el mes actual usando las URLs ya conocidas en la base de datos
 * del departamento. Para cada patrón de slug con sufijo numérico encontrado en meses anteriores,
 * genera los siguientes N números en el mes actual.
 *
 * Esto captura posts como /2026/04/convocatoria-...-n2-...-205 cuando Facebook no incrusta la
 * URL completa en su HTML (el l.php solo apunta al dominio raíz).
 *
 * La validación real ocurre en el paso de enriquecimiento: si la URL no existe en CGE, WordPress
 * redirige al home y `p.cgeUrl` queda como el dominio raíz, lo que hace fallar
 * `isCgeUrlCurrentYearMonth` y el candidato se descarta automáticamente.
 */
async function generateDbSeedCandidates(
  prisma: PrismaClient,
  departmentId: number,
  filterYm: string, // "YYYY/MM"
): Promise<FacebookPost[]> {
  const [filterYStr, filterMStr] = filterYm.split("/");
  const filterY = Number(filterYStr);

  // Obtener las URLs de concursos recientes del departamento (últimos 120 días).
  const recentContests = await prisma.contest.findMany({
    where: {
      school: { department_id: departmentId },
      source_url: { contains: "cge.entrerios.gov.ar" },
    },
    select: { source_url: true },
    orderBy: { created_at: "desc" },
    take: 300,
  });

  // Agrupar por base de slug (sin el sufijo numérico final), registrando el número máximo visto.
  const slugMaxByBase = new Map<string, { basePath: string; maxNum: number; yearMonth: string }>();
  for (const { source_url } of recentContests) {
    if (!source_url) continue;
    try {
      const rawNorm = source_url.split("?")[0].split("#")[0].replace(/\/$/, "");
      const u = new URL(rawNorm);
      if (!u.hostname.toLowerCase().includes("cge.entrerios.gov.ar")) continue;
      const pth = u.pathname.toLowerCase().replace(/\/+$/, "");
      const ymMatch = pth.match(/^\/(\d{4}\/\d{2})\//);
      if (!ymMatch) continue;
      const urlYm = ymMatch[1]; // e.g. "2026/03"
      const pnm = pth.match(/^(.*)-(\d{1,4})$/);
      if (!pnm) continue;
      // Para URLs del mes anterior: transformamos la base al mes actual antes de guardarla.
      // Para URLs del mes actual: las usamos directamente como semilla (el FB no siempre captura todos los posts).
      let basePath = pnm[1]; // e.g. "/2026/03/convocatoria-...-n2-islas..."
      if (urlYm !== filterYm) {
        // Cross-month: transformar /YYYY/MM/ al mes actual para generar candidatos del mes en curso.
        const slugOnly = basePath.replace(/^\/\d{4}\/\d{2}\//, "");
        basePath = `/${filterY}/${filterMStr}/${slugOnly}`;
      }
      const num = parseInt(pnm[2], 10);
      if (num < 1 || num > 9999) continue;
      const existing = slugMaxByBase.get(basePath);
      if (!existing || num > existing.maxNum) {
        slugMaxByBase.set(basePath, { basePath, maxNum: num, yearMonth: urlYm });
      }
    } catch {
      /* ignore */
    }
  }

  const candidates: FacebookPost[] = [];
  const PROBE_RANGE = 15; // Número de candidatos a generar por encima del último visto.

  for (const { basePath, maxNum } of slugMaxByBase.values()) {
    // basePath ya está normalizado al mes actual (cross-month o mismo mes).
    const currentMonthBase = basePath;

    for (let i = maxNum + 1; i <= maxNum + PROBE_RANGE; i++) {
      const candidateUrl = `https://cge.entrerios.gov.ar${currentMonthBase}-${i}`;
      candidates.push({
        pageUrl: "https://cge.entrerios.gov.ar/",
        postUrl: candidateUrl,
        text: "",
        cgeUrl: candidateUrl,
        dbSeedCandidate: true,
      });
    }
  }

  if (candidates.length > 0) {
    facebookScraperLogger.info("Facebook scraper → candidatos DB-seed generados", {
      count: candidates.length,
      filterYm,
      slugBasesCount: slugMaxByBase.size,
      sampleUrls: candidates.slice(0, 5).map((c) => c.postUrl),
    });
  }

  return candidates;
}

/**
 * Sondea secuencialmente las URLs de CGE para un slug base dado, comenzando desde startNum.
 * Detiene cuando encuentra MAX_CONSECUTIVE_NOT_FOUND URLs inexistentes seguidas.
 * Retorna los posts válidos encontrados (con texto enriquecido desde CGE).
 *
 * Esto actúa como backup robusto: WordPress numera slugs consecutivamente, así que
 * si -207 y -208 existen pero -209 no, detenemos en -209 (o al segundo fallo).
 */
async function probeSlugBaseSequentially(
  browser: Browser,
  facebookContextUsesTor: boolean,
  slugBaseUrl: string, // e.g. "https://cge.entrerios.gov.ar/2026/04/convocatoria-...-n2-..."
  startNum: number,
  existingUrlSet: Set<string>,
  isJunkContent: (text: string) => boolean,
): Promise<FacebookPost[]> {
  const MAX_PROBES = 30;
  // WordPress asigna sufijos numéricos de forma consecutiva: si N no existe, N+1 tampoco.
  // Paramos inmediatamente en el primer "en construcción" para no perder tiempo.
  const MAX_CONSECUTIVE_NOT_FOUND = 1;

  const found: FacebookPost[] = [];
  let consecutiveNotFound = 0;

  for (let i = startNum; i < startNum + MAX_PROBES; i++) {
    const url = `${slugBaseUrl}-${i}`;
    const normalized = url.replace(/\/$/, "");

    if (existingUrlSet.has(normalized)) {
      // Ya guardado previamente; no interrumpir la secuencia
      consecutiveNotFound = 0;
      continue;
    }

    const candidate: FacebookPost = {
      pageUrl: "https://cge.entrerios.gov.ar/",
      postUrl: normalized,
      text: "",
      cgeUrl: normalized,
      dbSeedCandidate: true,
    };

    facebookScraperLogger.debug("Facebook scraper → sondeo secuencial CGE", { url: normalized, num: i });
    await enrichPostFromDetails(browser, candidate, facebookContextUsesTor);
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));

    const isEmpty = !candidate.text.trim();
    const isJunk = isEmpty || isJunkContent(candidate.text);

    if (isJunk) {
      consecutiveNotFound++;
      facebookScraperLogger.debug("Facebook scraper → sondeo secuencial: URL no encontrada", {
        url: normalized,
        consecutiveNotFound,
      });
      if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) break;
    } else {
      consecutiveNotFound = 0;
      existingUrlSet.add(normalized);
      found.push(candidate);
      facebookScraperLogger.info("Facebook scraper → sondeo secuencial: nueva URL encontrada", {
        url: normalized,
        textPreview: candidate.text.slice(0, 80),
      });
    }
  }

  return found;
}

/**
 * Construye el mapa de {slugBase → maxNum} a partir de las URLs del mes actual en la DB
 * para el departamento dado. Usado por el sondeo secuencial como punto de inicio.
 */
async function buildCurrentMonthSlugBases(
  prisma: PrismaClient,
  departmentId: number,
  filterYm: string,
): Promise<Map<string, number>> {
  const contests = await prisma.contest.findMany({
    where: {
      school: { department_id: departmentId },
      source_url: { contains: `cge.entrerios.gov.ar/${filterYm}/` },
    },
    select: { source_url: true },
  });

  const slugMaxMap = new Map<string, number>();
  for (const { source_url } of contests) {
    if (!source_url) continue;
    try {
      const raw = source_url.split("?")[0].split("#")[0].replace(/\/$/, "");
      const u = new URL(raw);
      const pth = u.pathname.toLowerCase().replace(/\/+$/, "");
      const m = pth.match(/^(.*)-(\d{1,4})$/);
      if (!m) continue;
      const num = parseInt(m[2], 10);
      if (num < 1 || num > 9999) continue;
      // Reconstruir la URL base completa con el host original
      const base = `https://cge.entrerios.gov.ar${m[1]}`;
      const existing = slugMaxMap.get(base);
      if (!existing || num > existing) slugMaxMap.set(base, num);
    } catch {
      /* ignore */
    }
  }
  return slugMaxMap;
}

/** Keywords que identifican publicaciones del departamento Islas del Ibicuy en la URL del CGE. */
const IBICUY_URL_KEYWORDS = [
  "ibicuy", "ceibas", "paranacito", "mazaruca", "giorgi", "islas-del-ibicuy",
];

/**
 * Consulta la WordPress REST API del CGE para obtener todos los concursos del mes actual
 * relacionados con el departamento Islas del Ibicuy.
 *
 * Categorías:
 *  - 150: Concursos Nivel Primario  (NEP, escuelas nocturnas, etc. — no cubiertas por el scraper departamental)
 *  - 151: Concursos Nivel Secundario (complementa el scraper departamental con rango de fecha completo)
 *
 * La REST API devuelve título + contenido HTML, por lo que los posts ya vienen con texto
 * y no necesitan enriquecimiento posterior.
 */
async function fetchIbicuyContestsFromRestApi(filterYm: string): Promise<FacebookPost[]> {
  const [year, month] = filterYm.split("/");
  const afterDate = `${year}-${month}-01T00:00:00`;
  // WordPress acepta "before" con el último día del mes; usamos el 1ro del mes siguiente.
  const nextMonth = Number(month) === 12 ? `${Number(year) + 1}-01` : `${year}-${String(Number(month) + 1).padStart(2, "0")}`;
  const beforeDate = `${nextMonth}-01T00:00:00`;

  const WP_API = "https://cge.entrerios.gov.ar/wp-json/wp/v2/posts";
  const CATEGORIES = [150, 151]; // primaria, secundaria
  const found: FacebookPost[] = [];
  const seenUrls = new Set<string>();

  for (const categoryId of CATEGORIES) {
    let page = 1;
    while (true) {
      try {
        const { data } = await axios.get<
          Array<{ id: number; link: string; title: { rendered: string }; content: { rendered: string } }>
        >(WP_API, {
          params: {
            per_page: 100,
            page,
            after: afterDate,
            before: beforeDate,
            categories: categoryId,
            orderby: "date",
            order: "desc",
            _fields: "id,link,title,content",
          },
          timeout: 20_000,
        });

        if (!Array.isArray(data) || data.length === 0) break;

        for (const post of data) {
          const link = (post.link ?? "").replace(/\/$/, "");
          if (!link) continue;

          const linkLower = link.toLowerCase();
          const isIbicuy = IBICUY_URL_KEYWORDS.some((kw) => linkLower.includes(kw));
          if (!isIbicuy) continue;
          if (seenUrls.has(link)) continue;
          seenUrls.add(link);

          // Extraer texto plano desde el contenido HTML
          const titleText = post.title?.rendered?.replace(/<[^>]+>/g, " ").trim() ?? "";
          const contentText = post.content?.rendered?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
          const fullText = [titleText, contentText].filter(Boolean).join("\n\n");

          facebookScraperLogger.info("Facebook scraper → REST API: concurso Ibicuy encontrado", {
            url: link,
            category: categoryId,
            titlePreview: titleText.slice(0, 80),
          });

          found.push({
            pageUrl: "https://cge.entrerios.gov.ar/",
            postUrl: link,
            text: fullText,
            cgeUrl: link,
          });
        }

        if (data.length < 100) break;
        page++;
      } catch (err) {
        facebookScraperLogger.warn("Facebook scraper → REST API: error fetching posts", {
          category: categoryId,
          page,
          error: (err as Error)?.message ?? String(err),
        });
        break;
      }
    }
  }

  facebookScraperLogger.info("Facebook scraper → REST API Ibicuy: total encontrados", {
    count: found.length,
    filterYm,
  });

  return found;
}

export async function runFacebookCgeScraper(prisma: PrismaClient): Promise<number> {
  const filterYm = `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const pagesLog = FACEBOOK_PAGES.map((p) => ({
    pageUrl: p.pageUrl,
    department: p.departmentSlug,
  }));
  appLogger.info("Iniciando scraper Facebook CGE", {
    pages: pagesLog,
    cgeUrlOnlyYearMonth: filterYm,
  });
  facebookScraperLogger.info("Iniciando scraper Facebook CGE", {
    pages: pagesLog,
    cgeUrlOnlyYearMonth: filterYm,
  });

  let { browser, facebookContextUsesTor } = await createBrowser();
  let created = 0;

  // Normalizamos URLs para deduplicación consistente:
  // - Quitamos query params (ej. fbclid)
  // - Quitamos fragmentos
  // - Quitamos slash final
  const normalizeCgeUrl = (url: string) =>
    String(url)
      .split("#")[0]
      .split("?")[0]
      .replace(/\/$/, "");

  /**
   * El CGE usa WordPress que genera slugs numerados cuando hay posts con slugs similares:
   * /ceibas, /ceibas-2, /ceibas-90, /ceibas-118...
   * Para deduplicar, normalizamos quitando el sufijo numérico final del slug.
   * Así /ceibas-112 y /ceibas-118 se tratan como el mismo concurso.
   */
  const slugBase = (url: string) => url.replace(/-\d+$/, "");

  /** Detecta respuestas de error del CGE (CGE devuelve HTTP 200 con contenido de error cuando una página no existe). */
  const isJunkContent = (text: string): boolean => {
    const t = text.toLowerCase();
    return (
      // Página en construcción (respuesta típica de WordPress del CGE para URLs inexistentes)
      t.includes("página solicitada está en construcción") ||
      t.includes("pagina solicitada esta en construccion") ||
      t.includes("en construcción\n\ngobierno de entre") ||
      // WordPress 404 estándar
      t.includes("página no encontrada") ||
      t.includes("pagina no encontrada") ||
      t.includes("not found") ||
      t.includes("error 404") ||
      // Texto genérico del sitio sin contenido útil
      (t.includes("gobierno de entre ríos") && t.length < 150) ||
      (t.includes("gobierno de entre rios") && t.length < 150)
    );
  };

  try {
    for (const fbPage of FACEBOOK_PAGES) {
      const pageUrl = fbPage.pageUrl;
      const openPage = async () => {
        const page = await browser.newPage({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          viewport: { width: 1280, height: 720 },
        });
        page.setDefaultTimeout(60000);
        return page;
      };

      let page = await openPage();
      try {
        await ensureLoggedIn(page, pageUrl);
      } catch (err) {
        // Importante: aunque el launch del contexto con proxy haya funcionado, la navegación puede fallar
        // si Tor no está levantado o el proxy se cae. En ese caso, relanzamos el contexto sin proxy.
        if (facebookContextUsesTor && isTorProxyError(err)) {
          facebookScraperLogger.warn(
            "Facebook scraper → navegación falló con Tor/proxy; relanzando contexto sin proxy",
            {
              pageUrl,
              proxy: TOR_PROXY_URL,
              error: (err as Error)?.message ?? String(err),
            },
          );
          await page.close().catch(() => undefined);
          await browser.close().catch(() => undefined);
          ({ browser, facebookContextUsesTor } = await createBrowserWithoutProxy());
          page = await openPage();
          await ensureLoggedIn(page, pageUrl);
        } else {
          throw err;
        }
      }

      // Solo tomamos los primeros posts recientes de la página de Facebook.
      // Limite razonable para no scrollear de más.
      const posts = await scrollAndCollectPosts(page, 40);
      facebookScraperLogger.info("Posts encontrados en Facebook", {
        pageUrl,
        departmentSlug: fbPage.departmentSlug,
        count: posts.length,
        sampleUrls: posts.slice(0, 5).map((p) => p.postUrl),
      });

      // Resolver el departamento temprano para poder usarlo en la generación de candidatos DB-seed.
      let department = await prisma.department.findFirst({
        where: {
          OR: [{ slug: fbPage.departmentSlug }, { name: fbPage.departmentName }],
        },
      });
      if (!department) {
        department = await prisma.department.create({
          data: { name: fbPage.departmentName, slug: fbPage.departmentSlug },
        });
        facebookScraperLogger.info("Facebook scraper → departamento creado para el feed", {
          name: fbPage.departmentName,
          slug: fbPage.departmentSlug,
        });
      }

      // Agregar candidatos generados desde URLs ya conocidas en la BD (cross-month seed).
      // Captura posts cuya URL completa no aparece en el HTML de Facebook (solo el dominio raíz).
      const seedCandidates = await generateDbSeedCandidates(prisma, department.id, filterYm);
      const postsUrlSet = new Set(posts.map((p) => normalizeCgeUrl(p.cgeUrl ?? p.postUrl)));
      for (const sc of seedCandidates) {
        const norm = normalizeCgeUrl(sc.postUrl);
        if (!postsUrlSet.has(norm)) {
          postsUrlSet.add(norm);
          posts.push(sc);
        }
      }

      // Antes de visitar los detalles, consultamos la base para ver cuáles posts/URLs
      // ya generaron concursos, y así evitar abrir de nuevo esas páginas.
      const existingFromFacebook = await prisma.contest.findMany({
        where: { source_name: SOURCE_NAME },
        select: { source_url: true },
      });
      const existingUrlSet = new Set(
        existingFromFacebook
          .map((c) => c.source_url)
          .filter((u): u is string => typeof u === "string" && !!u)
          .map((u) => normalizeCgeUrl(u)),
      );

      // Enriquecemos algunos posts visitando su página individual para obtener
      // el texto completo y links al CGE que sólo aparecen allí.
      const postsToEnrich = posts
        .filter((p) => {
          const candidateUrl = normalizeCgeUrl(p.cgeUrl ?? p.postUrl);
          if (existingUrlSet.has(candidateUrl)) {
            facebookScraperLogger.info("Facebook scraper → post ya procesado previamente, se omite detalle", {
              sourceUrl: candidateUrl,
            });
            return false;
          }
          return true;
        })
        .slice(0, 40);
      for (const p of postsToEnrich) {
        const enrichTargetIsCge = isCgeHostUrl(p.postUrl);
        facebookScraperLogger.info("Facebook scraper → enriqueciendo post", {
          postUrl: p.postUrl,
          hasCgeUrlBefore: !!p.cgeUrl,
          facebook_context_uses_tor: facebookContextUsesTor,
          enrich_target_is_cge: enrichTargetIsCge,
          enrich_will_try_tor: enrichTargetIsCge || facebookContextUsesTor,
        });
        await enrichPostFromDetails(browser, p, facebookContextUsesTor);
        facebookScraperLogger.info("Facebook scraper → post enriquecido", {
          postUrl: p.postUrl,
          hasCgeUrlAfter: !!p.cgeUrl,
        });
        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
      }

      // Por ahora, registramos posts como concursos básicos.
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 1);

      // El nombre de la escuela no es relevante; lo importante es que `department_id`
      // coincida con el scraper de CGE (Islas del Ibicuy).
      const schoolName = "Facebook CGE";
      let school = await prisma.school.findFirst({
        where: { name: schoolName, department_id: department.id },
      });
      if (!school) {
        school = await prisma.school.create({
          data: {
            name: schoolName,
            city: fbPage.departmentName,
            department: fbPage.departmentName,
            department_id: department.id,
          },
        });
      } else {
        // Mantener consistencia del feed Facebook: siempre Islas del Ibicuy.
        if (
          school.city !== fbPage.departmentName ||
          school.department !== fbPage.departmentName ||
          school.department_id !== department.id
        ) {
          school = await prisma.school.update({
            where: { id: school.id },
            data: {
              city: fbPage.departmentName,
              department: fbPage.departmentName,
              department_id: department.id,
            },
          });
        }
      }
      // El slug-base solo se usa para deduplicar dentro del run actual (no contra historia de la DB).
      // Usar slug-base contra la DB descartaría concursos nuevos del mismo colegio (ej: -215 bloqueado por -214).
      const existingSlugBaseSet = new Set<string>();

      for (const p of posts) {
        // Si dentro del post hay un link al CGE, lo usamos como URL principal
        // del concurso; si no, usamos el permalink del propio post.
        const sourceUrlRaw = p.cgeUrl ?? p.postUrl;
        const sourceUrl = normalizeCgeUrl(sourceUrlRaw);
        if (!isCgeUrlCurrentYearMonth(sourceUrl)) {
          facebookScraperLogger.info(
            "Facebook scraper → se omite (URL CGE no es año/mes actual en path)",
            { sourceUrl, expectedYearMonth: filterYm },
          );
          continue;
        }
        if (existingUrlSet.has(sourceUrl) || existingSlugBaseSet.has(slugBase(sourceUrl))) {
          facebookScraperLogger.info("Facebook scraper → concurso ya existente, se omite", {
            sourceUrl,
          });
          continue;
        }
        // Candidatos DB-seed: descartar si el enriquecimiento no confirmó que la URL existe.
        // Si la URL no existe en CGE, WordPress redirige al home y `sourceUrl` queda como root
        // (ya filtrado arriba por `isCgeUrlCurrentYearMonth`). Si el enriquecimiento falló del
        // todo, `text` queda vacío y no sabemos si la página existe → omitir por seguridad.
        if (p.dbSeedCandidate && !p.text.trim()) {
          facebookScraperLogger.debug("Facebook scraper → candidato DB-seed sin texto, se omite", {
            sourceUrl,
          });
          continue;
        }
        // Filtrar páginas de error del CGE (ej: "La página solicitada está en construcción")
        if (isJunkContent(p.text)) {
          facebookScraperLogger.info("Facebook scraper → se omite (contenido es página de error)", {
            sourceUrl,
            textPreview: p.text.slice(0, 80),
          });
          continue;
        }

        facebookScraperLogger.info("Facebook scraper → creando concurso desde post", {
          sourceUrl,
          hasCgeUrl: !!p.cgeUrl,
          titlePreview: p.text.slice(0, 120),
        });

        const parsed = extractContestFieldsFromText({
          title: p.text.slice(0, 200),
          description: p.text,
          fallbackContestDate: defaultDate,
          fallbackPublicationDate: defaultDate,
        });
        const subjectName = (parsed.subjectName ?? "General").slice(0, 255);
        let subject = await prisma.subject.findFirst({ where: { name: subjectName } });
        if (!subject) {
          subject = await prisma.subject.create({ data: { name: subjectName } });
        }

        await prisma.contest.create({
          data: {
            title: p.text.slice(0, 200),
            description: p.text,
            date: parsed.contestDate ?? defaultDate,
            publication_date: parsed.publicationDate ?? defaultDate,
            level: parsed.level ?? null,
            shift: parsed.shift ?? null,
            schedule: parsed.schedule ?? null,
            hours_to_cover: parsed.hoursToCover ?? null,
            school_id: school.id,
            subject_id: subject.id,
            source_url: sourceUrl,
            source_name: SOURCE_NAME,
            is_active: true,
          },
        });
        // Registrar en ambos sets para evitar duplicados dentro del mismo batch
        existingUrlSet.add(sourceUrl);
        existingSlugBaseSet.add(slugBase(sourceUrl));
        created++;
      }

      // ── Fase de sondeo secuencial ──────────────────────────────────────────────
      // Para cada slug base del mes actual con sufijo numérico (ej: .../ceibas-117),
      // sondeamos N+1, N+2, … hasta encontrar dos URLs inexistentes consecutivas.
      // Esto actúa como backup robusto: captura concursos que Facebook no muestra
      // como link completo y que el gap-fill fijo podría no alcanzar.
      const currentMonthBases = await buildCurrentMonthSlugBases(prisma, department.id, filterYm);
      facebookScraperLogger.info("Facebook scraper → inicio sondeo secuencial", {
        slugBasesCount: currentMonthBases.size,
        bases: Array.from(currentMonthBases.entries()).map(([b, n]) => `${b.split("/").pop()}-${n}`),
      });

      for (const [slugBaseUrl, maxNum] of currentMonthBases.entries()) {
        const seqPosts = await probeSlugBaseSequentially(
          browser,
          facebookContextUsesTor,
          slugBaseUrl,
          maxNum + 1,
          existingUrlSet,
          isJunkContent,
        );

        for (const p of seqPosts) {
          const sourceUrl = normalizeCgeUrl(p.cgeUrl ?? p.postUrl);
          if (existingSlugBaseSet.has(slugBase(sourceUrl))) continue;

          facebookScraperLogger.info("Facebook scraper → creando concurso (sondeo secuencial)", {
            sourceUrl,
            titlePreview: p.text.slice(0, 120),
          });

          const parsed = extractContestFieldsFromText({
            title: p.text.slice(0, 200),
            description: p.text,
            fallbackContestDate: defaultDate,
            fallbackPublicationDate: defaultDate,
          });
          const subjectName = (parsed.subjectName ?? "General").slice(0, 255);
          let subject = await prisma.subject.findFirst({ where: { name: subjectName } });
          if (!subject) {
            subject = await prisma.subject.create({ data: { name: subjectName } });
          }

          await prisma.contest.create({
            data: {
              title: p.text.slice(0, 200),
              description: p.text,
              date: parsed.contestDate ?? defaultDate,
              publication_date: parsed.publicationDate ?? defaultDate,
              level: parsed.level ?? null,
              shift: parsed.shift ?? null,
              schedule: parsed.schedule ?? null,
              hours_to_cover: parsed.hoursToCover ?? null,
              school_id: school.id,
              subject_id: subject.id,
              source_url: sourceUrl,
              source_name: SOURCE_NAME,
              is_active: true,
            },
          });

          existingUrlSet.add(sourceUrl);
          existingSlugBaseSet.add(slugBase(sourceUrl));
          created++;
        }
      }
      // ── Fin sondeo secuencial ───────────────────────────────────────────────────

      await page.close();
      await new Promise((r) => setTimeout(r, 3000 + Math.random() * 3000));
    }

    appLogger.info("Scraper Facebook CGE finalizado", { created });
    facebookScraperLogger.info("Scraper Facebook CGE finalizado", { created });
    return created;
  } catch (e) {
    appLogger.error("Error en scraper Facebook CGE", { error: (e as Error).message });
    facebookScraperLogger.error("Error en scraper Facebook CGE", { error: (e as Error).message });
    return created;
  } finally {
    await browser.close();
  }
}

