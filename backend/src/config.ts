import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, "..");
const ENV_PATH = path.join(BACKEND_DIR, ".env");
loadEnv({ path: ENV_PATH });

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("127.0.0.1"),
  SENDER_EMAIL: z.string().optional().default("").transform((s) => (s || "").trim()),
  BREVO_API_KEY: z.string().optional().default("").transform((s) => (s || "").trim()),
  SENDGRID_API_KEY: z.string().optional().default("").transform((s) => (s || "").trim()),
  SENDER_PASSWORD: z.string().optional().default("").transform((s) => (s || "").trim()),
  SCRAPING_TIMEOUT_MS: z.coerce.number().default(60000),
  /** "playwright" | "puppeteer" cuando se usa navegador */
  SCRAPING_ENGINE: z.enum(["playwright", "puppeteer"]).default("playwright"),
  /** Si true, intentar primero axios (rápido) y solo usar navegador si falla o contenido vacío */
  SCRAPING_PREFER_HTTP: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten());
  process.exit(1);
}

export const config = parsed.data;

export function isEmailConfigured(): boolean {
  return Boolean(
    config.SENDER_EMAIL &&
      (config.BREVO_API_KEY || config.SENDGRID_API_KEY || config.SENDER_PASSWORD)
  );
}
