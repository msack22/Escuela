import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, "../../logs");

export function getLogsDir(): string {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  return LOGS_DIR;
}

export function getFrontendLogPath(): string {
  return path.join(getLogsDir(), "frontend.log");
}

type LogLevel = "info" | "warn" | "error" | "debug";

function createLogger(name: string) {
  function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const ts = new Date().toISOString();
    const metaStr = meta ? " " + JSON.stringify(meta) : "";
    const line = `${ts} [${level.toUpperCase()}] [${name}] ${message}${metaStr}`;

    // Always print to console
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);

    // Write to file
    try {
      const logFile = path.join(getLogsDir(), `${name}.log`);
      fs.appendFileSync(logFile, line + "\n", "utf-8");
    } catch {
      // Ignore file write errors
    }
  }

  return {
    info:  (msg: string, meta?: Record<string, unknown>) => write("info",  msg, meta),
    warn:  (msg: string, meta?: Record<string, unknown>) => write("warn",  msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => write("error", msg, meta),
    debug: (msg: string, meta?: Record<string, unknown>) => write("debug", msg, meta),
  };
}

export const appLogger             = createLogger("app");
export const emailLogger           = createLogger("email");
export const cgeScraperLogger      = createLogger("cge-scraper");
export const facebookScraperLogger = createLogger("facebook-scraper");
export const alertsApiLogger       = createLogger("alerts-api");
