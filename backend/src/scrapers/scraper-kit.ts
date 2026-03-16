/**
 * Kit de scraping optimizado:
 * - axios → descargar páginas (rápido, sin navegador)
 * - cheerio → parsear HTML
 * - playwright / puppeteer → cuando hace falta JS o anti-bot
 *
 * Estrategia: intentar primero axios + cheerio; si falla o el contenido es vacío, usar navegador.
 */

import axios, { type AxiosRequestConfig } from "axios";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
import puppeteer from "puppeteer";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
};

const DEFAULT_TIMEOUT_MS = 30_000;

/** Descarga HTML con axios (rápido, para páginas estáticas). */
export async function fetchWithAxios(
  url: string,
  options: { timeout?: number; headers?: Record<string, string> } = {}
): Promise<string> {
  const config: AxiosRequestConfig = {
    url,
    method: "GET",
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    headers: { ...DEFAULT_HEADERS, ...options.headers },
    responseType: "text",
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  };
  const res = await axios(config);
  return res.data as string;
}

/** Parsea HTML con cheerio (selector tipo jQuery). */
export function parseHtml(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

export type BrowserEngine = "playwright" | "puppeteer";

/** Opciones para descargar con navegador. */
export interface BrowserFetchOptions {
  timeout?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  engine?: BrowserEngine;
}

/** Descarga HTML con Playwright (Chrome). */
export async function fetchWithPlaywright(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<string> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const waitUntil = options.waitUntil ?? "domcontentloaded";
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeout);
    await page.setExtraHTTPHeaders(DEFAULT_HEADERS);
    await page.goto(url, { waitUntil, timeout });
    return await page.content();
  } finally {
    await browser.close();
  }
}

/** Descarga HTML con Puppeteer (Chrome). */
export async function fetchWithPuppeteer(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<string> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(timeout);
    await page.setExtraHTTPHeaders(DEFAULT_HEADERS);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    return await page.content();
  } finally {
    await browser.close();
  }
}

/** Descarga con el motor de navegador indicado. */
export async function fetchWithBrowser(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<string> {
  if (options.engine === "puppeteer") {
    return fetchWithPuppeteer(url, options);
  }
  return fetchWithPlaywright(url, options);
}

/**
 * Estrategia optimizada: intenta axios primero; si falla o el body es "vacío" (poco texto), usa navegador.
 * Útil para sitios que a veces sirven HTML estático y a veces requieren JS.
 */
export async function fetchHtmlOptimized(
  url: string,
  options: {
    timeout?: number;
    engine?: BrowserEngine;
    minLength?: number; // si el HTML tiene menos caracteres, considerar vacío y usar browser
  } = {}
): Promise<{ html: string; via: "axios" | "playwright" | "puppeteer" }> {
  const minLength = options.minLength ?? 500;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

  try {
    const html = await fetchWithAxios(url, { timeout });
    if (html.length >= minLength) {
      return { html, via: "axios" };
    }
  } catch {
    // axios falló (404, timeout, bloqueo, etc.) → usar navegador
  }

  const engine = options.engine ?? "playwright";
  const browserHtml = await fetchWithBrowser(url, { timeout, engine });
  return { html: browserHtml, via: engine };
}
