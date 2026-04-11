import type { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
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
  // Los concursos relevantes suelen estar arriba del feed; no hace falta scrollear como 50+ veces.
  const minScrollIterations = 10;
  /** Tope duro: no seguir bajando más allá de esto. */
  const maxScrollIterations = 35;

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

    // -- Playwright-native fallback ------------------------------------------
    // El IIFE browser script puede perder links directos al CGE cuando:
    //   a) el preview card del post carga con delay (lazy render de React)
    //   b) Facebook ya virtualizo el post (lo quito del DOM) antes de que el IIFE lo viera
    // Aqui buscamos con Playwright DESPUES del scroll+wait, cuando el nuevo contenido
    // ya cargo, y antes de que el viejo sea virtualizado.
    if (posts.length < maxPosts) {
      const nativeCgeLinks = await page
        .$$eval(
          'a[href*="cge.entrerios.gov.ar"], a[href*="cge%2Eentrerios"]',
          (anchors: Element[]) =>
            (anchors as HTMLAnchorElement[]).map((a) => {
              const href = a.href || a.getAttribute("href") || "";
              // Intentar obtener el texto del post contenedor
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
            iteration,
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
    }
    // -------------------------------------------------------------------------

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
        // El cuerpo de la nota a veces llega después del HTML inicial (AJAX / fuentes).
        await detailPage
          .waitForSelector(".texto p, .texto, .entry-content, article .entry-content", {
            timeout: 25_000,
          })
          .catch(() => undefined);
      }
      const { text, cgeUrl } = await extractPostDetailFromPage(detailPage);
      const prev = (post.text ?? "").trim();
      const looksPlaceholder =
        prev.length === 0 || /^Facebook post\b/i.test(prev) || prev.length < 60;
      if (
        text &&
        text.trim().length > 0 &&
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

      // Mismo departamento que la DDE del feed (p. ej. Islas del Ibicuy), no provincia genérica.
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
        if (existingUrlSet.has(sourceUrl)) {
          facebookScraperLogger.info("Facebook scraper → concurso ya existente, se omite", {
            sourceUrl,
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
        created++;
      }

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

