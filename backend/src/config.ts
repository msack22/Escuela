import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().default(8000),
  HOST: z.string().default("0.0.0.0"),
  SENDER_EMAIL: z.string().optional().default(""),
  BREVO_API_KEY: z.string().optional().default(""),
  SENDGRID_API_KEY: z.string().optional().default(""),
  SENDER_PASSWORD: z.string().optional().default(""),
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
