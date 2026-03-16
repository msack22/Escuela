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

/** Extrae enlaces a concursos del HTML (usa cheerio). */
function extractContestsFromHtml(html: string, baseUrl: string): Array<{ title: string; url: string; department: string; level?: string }> {
  const $ = parseHtml(html);
  const contests: Array<{ title: string; url: string; department: string; level?: string }> = [];

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

export async function runCgeScraper(prisma: PrismaClient): Promise<number> {
  const timeout = config.SCRAPING_TIMEOUT_MS ?? 60000;
  const engine = config.SCRAPING_ENGINE as BrowserEngine;
  const url = `${BASE_URL}/departamental-parana`;

  let html: string;
  let via: "axios" | "playwright" | "puppeteer" = "axios";

  if (config.SCRAPING_PREFER_HTTP) {
    const result = await fetchHtmlOptimized(url, {
      timeout,
      engine,
      minLength: 500,
    });
    html = result.html;
    via = result.via;
  } else {
    if (engine === "puppeteer") {
      html = await fetchWithPuppeteer(url, { timeout, waitUntil: "domcontentloaded" });
      via = "puppeteer";
    } else {
      html = await fetchWithPlaywright(url, { timeout, waitUntil: "domcontentloaded" });
      via = "playwright";
    }
  }

  const contests = extractContestsFromHtml(html, BASE_URL);

  let created = 0;
  const defaultDate = new Date();
  defaultDate.setMonth(defaultDate.getMonth() + 1);

  for (const c of contests.slice(0, 50)) {
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
          date: defaultDate,
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
