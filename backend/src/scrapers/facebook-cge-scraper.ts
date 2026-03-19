import type { PrismaClient } from "@prisma/client";
import { chromium, type Browser, type Page } from "playwright";
import path from "path";
import { appLogger, facebookScraperLogger } from "../lib/logger.js";

const SOURCE_NAME = "Facebook CGE Entre Ríos";

// Páginas iniciales de Entre Ríos (se pueden ir sumando más)
const FACEBOOK_PAGES: string[] = ["https://www.facebook.com/ddeislasdelibicuy"];

// Directorio de perfil persistente para mantener sesión de Facebook entre ejecuciones.
const FB_USER_DATA_DIR = path.join(process.cwd(), ".playwright-facebook-profile");

interface FacebookPost {
  pageUrl: string;
  postUrl: string;
  text: string;
  createdAt?: Date;
  /** Último link a CGE encontrado dentro del post (si existe). */
  cgeUrl?: string;
}

async function createBrowser(): Promise<Browser> {
  // Usamos perfil persistente para que el usuario pueda iniciar sesión una sola vez.
  const context = await chromium.launchPersistentContext(FB_USER_DATA_DIR, {
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  // Compatibilizamos el tipo Browser usando el propio contexto, que expone newPage/close.
  // @ts-expect-error – adaptamos BrowserContext a la interfaz mínima usada.
  return context;
}

async function ensureLoggedIn(page: Page, pageUrl: string) {
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  // Si el usuario ya está logueado, Facebook redirige directamente al feed.
  // Si no, mostrará login; en ese caso el humano debe iniciar sesión manualmente una vez.
  facebookScraperLogger.info("Facebook page cargada para scraping", { url: pageUrl });

  // Damos un tiempo breve para iniciar sesión manualmente (si hace falta).
  await page.waitForTimeout(10000);
}

async function scrollAndCollectPosts(page: Page, maxPosts: number): Promise<FacebookPost[]> {
  const posts: FacebookPost[] = [];
  let lastHeight = await page.evaluate(() => document.body.scrollHeight);

  while (posts.length < maxPosts) {
    await page.waitForTimeout(2000 + Math.random() * 2000);

    // Pequeño diagnóstico para entender qué ve realmente el navegador.
    const diag = await page.evaluate(() => {
      const postNodes = document.querySelectorAll("article, div[role='article'], div.html-div");
      const anchors = document.querySelectorAll("a[href^='http']");
      return { postCount: postNodes.length, anchorCount: anchors.length };
    });

    facebookScraperLogger.debug("Facebook scraper → diagnóstico de DOM", {
      postCount: diag.postCount,
      anchorCount: diag.anchorCount,
    });

    // Logueamos una muestra de los primeros posts para entender mejor su estructura.
    if (posts.length === 0) {
      const sample = await page.evaluate(() => {
        const postNodes = Array.from(
          document.querySelectorAll("article, div[role='article'], div.html-div"),
        ) as HTMLElement[];

        return postNodes.slice(0, 3).map((post, idx) => {
          const text = post.innerText?.trim() ?? "";
          const anchors = Array.from(
            post.querySelectorAll("a[href^='http']"),
          ) as HTMLAnchorElement[];

          const hrefs = anchors.map((a) => a.href).filter(Boolean);

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

    const newPosts = await page.evaluate(() => {
      const results: { postUrl: string; text: string; cgeUrl?: string }[] = [];
      const seen = new Set<string>();

      // 1) Recorremos posts y tomamos TODOS los links externos que haya en cada uno.
      // Incluimos también los contenedores específicos de contenido de post (`div.html-div`).
      const postNodes = Array.from(
        document.querySelectorAll("article, div[role='article'], div.html-div"),
      ) as HTMLElement[];

      for (const post of postNodes) {
        const fullText = post.innerText?.trim() ?? "";
        if (!fullText) continue;

        const anchors = Array.from(
          post.querySelectorAll("a[href^='http']"),
        ) as HTMLAnchorElement[];

        for (const a of anchors) {
          let href = a.href || "";
          if (!href) continue;

          try {
            const url = new URL(href);
            const hostname = url.hostname.toLowerCase();

            if (hostname.includes("l.facebook.com")) {
              const original = url.searchParams.get("u");
              if (original) {
                href = original;
              }
            }

            if (
              hostname.includes("facebook.com") ||
              hostname.includes("fbcdn.net") ||
              hostname.endsWith(".facebook.com")
            ) {
              continue;
            }
          } catch {
            // seguimos con href original si falla
          }

          if (!href || seen.has(href)) continue;
          seen.add(href);

          const hasCgeInText = fullText.includes("cge.entrerios.gov.ar");

          results.push({
            postUrl: href,
            text: fullText,
            cgeUrl: hasCgeInText ? href : undefined,
          });
        }
      }

      // 2) Fallback: posts cuyo texto contenga alguna URL al dominio del CGE.
      const possiblePosts = Array.from(
        document.querySelectorAll("article, div[role='article'], div"),
      ) as HTMLElement[];

      for (const el of possiblePosts) {
        const fullText = el.innerText?.trim() ?? "";
        if (!fullText) continue;

        if (!fullText.includes("cge.entrerios.gov.ar")) continue;

        const match = fullText.match(/https?:\/\/\S*?cge\.entrerios\.gov\.ar\S*/i);
        if (!match) continue;

        const urlText = match[0];
        if (seen.has(urlText)) continue;
        seen.add(urlText);

        results.push({ postUrl: urlText, text: fullText, cgeUrl: urlText });
      }

      return results;
    });

    facebookScraperLogger.debug("Facebook scraper → anchors analizados en scroll", {
      batchSize: newPosts.length,
      totalSoFar: posts.length,
    });

    for (const p of newPosts) {
      const duplicated = !!posts.find((x) => x.postUrl === p.postUrl);
      facebookScraperLogger.debug("Facebook scraper → post detectado en feed", {
        postUrl: p.postUrl,
        hasText: !!p.text,
        hasCgeUrl: !!p.cgeUrl,
        duplicated,
      });
      if (!duplicated) {
        posts.push({
          pageUrl: page.url(),
          postUrl: p.postUrl,
          text: p.text,
          cgeUrl: p.cgeUrl,
        });
      }
      if (posts.length >= maxPosts) break;
    }

    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(1500 + Math.random() * 1500);
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === lastHeight) break;
    lastHeight = newHeight;
  }

  return posts;
}

/** Visita el post individual para extraer texto completo y, si falta, el link al CGE. */
async function enrichPostFromDetails(browser: Browser, post: FacebookPost): Promise<FacebookPost> {
  try {
    const detailPage = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });

    facebookScraperLogger.info("Facebook scraper → visitando post individual", {
      url: post.postUrl,
    });
    await detailPage.goto(post.postUrl, { waitUntil: "networkidle" });

    const { text, cgeUrl } = await detailPage.evaluate(() => {
      const container =
        document.querySelector("article") ||
        document.querySelector("div[role='article']") ||
        document.body;

      const el = container as HTMLElement;
      const fullText = el?.innerText?.trim() ?? "";

      let bestCgeLink: string | undefined;
      let bestScore = -Infinity;

      const scoreCgeHref = (href: string) => {
        try {
          const url = new URL(href);
          const path = url.pathname.toLowerCase();

          // Descartamos explícitamente cosas que no son concursos.
          if (path.includes("/noticias/") || path.includes("noticias")) return -1000;
          if (path.includes("feriadecarrerasyoficios")) return -1000;

          const looksLikeContest =
            path.includes("concurso") ||
            path.includes("oposicion") ||
            path.includes("oposición") ||
            path.includes("convocatoria") ||
            path.includes("llamado");
          if (!looksLikeContest) return -200;

          let score = 0;
          if (path.includes("convocatoria-concurso")) score += 60;
          if (path.includes("llamado-a-concurso")) score += 50;
          if (path.includes("escuela")) score += 5;
          if (path.includes("secundaria")) score += 5;

          // Priorizamos enlaces que incluyan ruta /YYYY/MM/
          if (/\/\d{4}\/\d{2}\//.test(path)) score += 10;

          return score;
        } catch {
          return -200;
        }
      };

      const anchors = Array.from(el.querySelectorAll("a")) as HTMLAnchorElement[];
      for (const a of anchors) {
        let href = a.href || "";
        if (!href) continue;

        try {
          const url = new URL(href);
          if (url.hostname.includes("l.facebook.com")) {
            const original = url.searchParams.get("u");
            if (original) {
              href = original;
            }
          }
        } catch {
          // ignoramos errores de parseo
        }

        if (href.toLowerCase().includes("cge.entrerios.gov.ar")) {
          const score = scoreCgeHref(href);
          if (score > bestScore) {
            bestScore = score;
            bestCgeLink = href;
          }
        }
      }

      return { text: fullText, cgeUrl: bestCgeLink };
    });

    if (text) {
      post.text = text;
    }
    if (cgeUrl) post.cgeUrl = cgeUrl;

    await detailPage.close();
  } catch (err) {
    facebookScraperLogger.warn("Facebook CGE scraper → fallo al enriquecer post", {
      url: post.postUrl,
      error: (err as Error)?.message ?? String(err),
    });
  }

  return post;
}

export async function runFacebookCgeScraper(prisma: PrismaClient): Promise<number> {
  appLogger.info("Iniciando scraper Facebook CGE", { pages: FACEBOOK_PAGES });
  facebookScraperLogger.info("Iniciando scraper Facebook CGE", { pages: FACEBOOK_PAGES });

  const browser = await createBrowser();
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
    for (const pageUrl of FACEBOOK_PAGES) {
      const page = await browser.newPage({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
      });
      page.setDefaultTimeout(60000);

      await ensureLoggedIn(page, pageUrl);

      // Solo tomamos los primeros posts recientes de la página de Facebook.
      // Limite razonable para no scrollear de más.
      const posts = await scrollAndCollectPosts(page, 10);
      facebookScraperLogger.info("Posts encontrados en Facebook", {
        pageUrl,
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
        .slice(0, 10);
      for (const p of postsToEnrich) {
        facebookScraperLogger.info("Facebook scraper → enriqueciendo post", {
          postUrl: p.postUrl,
          hasCgeUrlBefore: !!p.cgeUrl,
        });
        await enrichPostFromDetails(browser, p);
        facebookScraperLogger.info("Facebook scraper → post enriquecido", {
          postUrl: p.postUrl,
          hasCgeUrlAfter: !!p.cgeUrl,
        });
        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
      }

      // Por ahora, registramos posts como concursos básicos.
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 1);

      // Departamento genérico para concursos provenientes de Facebook.
      const depName = "Entre Ríos";
      const depSlug = "entre-rios";
      let department = await prisma.department.findFirst({
        where: { OR: [{ slug: depSlug }, { name: depName }] },
      });
      if (!department) {
        department = await prisma.department.create({
          data: { name: depName, slug: depSlug },
        });
      }

      let school = await prisma.school.findFirst({
        where: { name: "Facebook CGE", department_id: department.id },
      });
      if (!school) {
        school = await prisma.school.create({
          data: {
            name: "Facebook CGE",
            city: depName,
            department: depName,
            department_id: department.id,
          },
        });
      }
      let subject = await prisma.subject.findFirst({ where: { name: "General" } });
      if (!subject) {
        subject = await prisma.subject.create({ data: { name: "General" } });
      }

      for (const p of posts) {
        // Si dentro del post hay un link al CGE, lo usamos como URL principal
        // del concurso; si no, usamos el permalink del propio post.
        const sourceUrlRaw = p.cgeUrl ?? p.postUrl;
        const sourceUrl = normalizeCgeUrl(sourceUrlRaw);
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

        await prisma.contest.create({
          data: {
            title: p.text.slice(0, 200),
            description: p.text,
            date: defaultDate,
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

