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
import { SocksProxyAgent } from "socks-proxy-agent";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
};

const DEFAULT_TIMEOUT_MS = 30_000;

/** Configuración de proxy Tor (SOCKS5). */
const TOR_PROXY_URL = process.env.TOR_PROXY_URL || "socks5://127.0.0.1:9050";

function isProxyConnectionError(error: unknown): boolean {
  const message = (error as Error)?.message?.toLowerCase?.() ?? "";
  return (
    message.includes("err_proxy_connection_failed") ||
    message.includes("proxy connection failed") ||
    message.includes("socks") ||
    message.includes("proxy")
  );
}

/** Descarga HTML con axios (rápido, para páginas estáticas). */
export async function fetchWithAxios(
  url: string,
  options: { timeout?: number; headers?: Record<string, string>; useTor?: boolean } = {}
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

  // Si se solicita usar Tor, configuramos el agente SOCKS5.
  if (options.useTor) {
    config.httpAgent = new SocksProxyAgent(TOR_PROXY_URL);
    config.httpsAgent = new SocksProxyAgent(TOR_PROXY_URL);
  }

  const res = await axios(config);
  return res.data as string;
}

/** Parsea HTML con cheerio (selector tipo jQuery). */
export function parseHtml(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

export type BrowserEngine = "playwright" | "puppeteer";
export type TorUsageMeta = {
  requested: boolean;
  used: boolean;
  fallbackToDirect: boolean;
};

/** Opciones para descargar con navegador. */
export interface BrowserFetchOptions {
  timeout?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  engine?: BrowserEngine;
  useTor?: boolean;
}

async function fetchWithPlaywrightDetailed(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<{ html: string; torUsed: boolean; fallbackToDirect: boolean }> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const waitUntil = options.waitUntil ?? "domcontentloaded";
  const useTor = options.useTor ?? false;
  try {
    const browser = await chromium.launch({
      headless: true,
      proxy: useTor ? { server: TOR_PROXY_URL } : undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(timeout);
      await page.setExtraHTTPHeaders(DEFAULT_HEADERS);
      await page.goto(url, { waitUntil, timeout });
      return { html: await page.content(), torUsed: useTor, fallbackToDirect: false };
    } finally {
      await browser.close();
    }
  } catch (error) {
    if (useTor && isProxyConnectionError(error)) {
      const direct = await fetchWithPlaywrightDetailed(url, { ...options, useTor: false });
      return { html: direct.html, torUsed: false, fallbackToDirect: true };
    }
    throw error;
  }
}

async function fetchWithPuppeteerDetailed(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<{ html: string; torUsed: boolean; fallbackToDirect: boolean }> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const useTor = options.useTor ?? false;
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        ...(useTor ? [`--proxy-server=${TOR_PROXY_URL}`] : []),
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(timeout);
      await page.setExtraHTTPHeaders(DEFAULT_HEADERS);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      return { html: await page.content(), torUsed: useTor, fallbackToDirect: false };
    } finally {
      await browser.close();
    }
  } catch (error) {
    if (useTor && isProxyConnectionError(error)) {
      const direct = await fetchWithPuppeteerDetailed(url, { ...options, useTor: false });
      return { html: direct.html, torUsed: false, fallbackToDirect: true };
    }
    throw error;
  }
}

/** Descarga HTML con Playwright (Chrome). */
export async function fetchWithPlaywright(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<string> {
  const result = await fetchWithPlaywrightDetailed(url, options);
  return result.html;
}

/** Descarga HTML con Puppeteer (Chrome). */
export async function fetchWithPuppeteer(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<string> {
  const result = await fetchWithPuppeteerDetailed(url, options);
  return result.html;
}

/** Descarga con el motor de navegador indicado. */
export async function fetchWithBrowser(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<string> {
  const result = await fetchWithBrowserDetailed(url, options);
  return result.html;
}

export async function fetchWithBrowserDetailed(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<{ html: string; via: BrowserEngine; torUsed: boolean; fallbackToDirect: boolean }> {
  if (options.engine === "puppeteer") {
    const result = await fetchWithPuppeteerDetailed(url, options);
    return { html: result.html, via: "puppeteer", torUsed: result.torUsed, fallbackToDirect: result.fallbackToDirect };
  }
  const result = await fetchWithPlaywrightDetailed(url, options);
  return { html: result.html, via: "playwright", torUsed: result.torUsed, fallbackToDirect: result.fallbackToDirect };
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
    useTor?: boolean;
  } = {}
): Promise<{ html: string; via: "axios" | "playwright" | "puppeteer"; tor: TorUsageMeta }> {
  const minLength = options.minLength ?? 500;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const useTor = options.useTor ?? true;

  try {
    const html = await fetchWithAxios(url, { timeout, useTor });
    if (html.length >= minLength) {
      return {
        html,
        via: "axios",
        tor: { requested: useTor, used: useTor, fallbackToDirect: false },
      };
    }
  } catch (error) {
    // Si falla Tor, probamos HTTP directo antes de abrir navegador.
    if (useTor && isProxyConnectionError(error)) {
      try {
        const htmlDirect = await fetchWithAxios(url, { timeout, useTor: false });
        if (htmlDirect.length >= minLength) {
          return {
            html: htmlDirect,
            via: "axios",
            tor: { requested: true, used: false, fallbackToDirect: true },
          };
        }
      } catch {
        // Si también falla en directo, continúa fallback a navegador.
      }
    }
    // axios falló (404, timeout, bloqueo, etc.) → usar navegador
  }

  const engine = options.engine ?? "playwright";
  const browserResult = await fetchWithBrowserDetailed(url, { timeout, engine, useTor });
  return {
    html: browserResult.html,
    via: browserResult.via,
    tor: {
      requested: useTor,
      used: browserResult.torUsed,
      fallbackToDirect: browserResult.fallbackToDirect,
    },
  };
}
