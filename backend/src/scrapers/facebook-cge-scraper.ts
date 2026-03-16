import type { PrismaClient } from "@prisma/client";
import { chromium, type Browser, type Page } from "playwright";
import { appLogger } from "../lib/logger.js";

const SOURCE_NAME = "Facebook CGE Entre Ríos";

// Páginas iniciales de Entre Ríos (se pueden ir sumando más)
const FACEBOOK_PAGES: string[] = [
  "https://www.facebook.com/ddeislasdelibicuy",
];

interface FacebookPost {
  pageUrl: string;
  postUrl: string;
  text: string;
  createdAt?: Date;
}

async function createBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}

async function ensureLoggedIn(page: Page, pageUrl: string) {
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  // Si el usuario ya está logueado, Facebook redirige directamente al feed.
  // Si no, mostrará login; en ese caso el humano debe iniciar sesión manualmente una vez.
  appLogger.info("Facebook page cargada para scraping", { url: pageUrl });
}

async function scrollAndCollectPosts(page: Page, maxPosts: number): Promise<FacebookPost[]> {
  const posts: FacebookPost[] = [];
  let lastHeight = await page.evaluate(() => document.body.scrollHeight);

  while (posts.length < maxPosts) {
    await page.waitForTimeout(2000 + Math.random() * 2000);

    const newPosts = await page.evaluate(() => {
      const results: { postUrl: string; text: string }[] = [];
      const anchors = Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[];
      for (const a of anchors) {
        const href = a.href || "";
        const text = a.innerText || "";
        if (!href.includes("/posts/")) continue;
        if (!text) continue;
        results.push({ postUrl: href, text });
      }
      return results;
    });

    for (const p of newPosts) {
      if (!posts.find((x) => x.postUrl === p.postUrl)) {
        posts.push({ pageUrl: page.url(), postUrl: p.postUrl, text: p.text });
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

export async function runFacebookCgeScraper(prisma: PrismaClient): Promise<number> {
  appLogger.info("Iniciando scraper Facebook CGE", { pages: FACEBOOK_PAGES });

  const browser = await createBrowser();
  let created = 0;

  try {
    for (const pageUrl of FACEBOOK_PAGES) {
      const page = await browser.newPage({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
      });
      page.setDefaultTimeout(60000);

      await ensureLoggedIn(page, pageUrl);

      const posts = await scrollAndCollectPosts(page, 20);
      appLogger.info("Posts encontrados en Facebook", { pageUrl, count: posts.length });

      // Por ahora, solo registramos posts como concursos muy básicos.
      // Se puede mejorar el parseo (fechas, escuela, materia) más adelante.
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 1);

      let school = await prisma.school.findFirst({ where: { name: "Facebook CGE" } });
      if (!school) {
        school = await prisma.school.create({
          data: { name: "Facebook CGE", city: "Entre Ríos", department: "Entre Ríos" },
        });
      }
      let subject = await prisma.subject.findFirst({ where: { name: "General" } });
      if (!subject) {
        subject = await prisma.subject.create({ data: { name: "General" } });
      }

      for (const p of posts) {
        const existing = await prisma.contest.findFirst({
          where: { source_url: p.postUrl, source_name: SOURCE_NAME },
        });
        if (existing) continue;

        await prisma.contest.create({
          data: {
            title: p.text.slice(0, 200),
            description: p.text,
            date: defaultDate,
            school_id: school.id,
            subject_id: subject.id,
            source_url: p.postUrl,
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
    return created;
  } catch (e) {
    appLogger.error("Error en scraper Facebook CGE", { error: (e as Error).message });
    return created;
  } finally {
    await browser.close();
  }
}

