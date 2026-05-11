/**
 * Logger del frontend: escribe en consola y envía al backend (backend/logs/frontend/frontend.log).
 */

const API_BASE = import.meta.env.VITE_API_URL ||
  `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:8000`;
const LOG_ENDPOINT = `${API_BASE}/api/logs/frontend`;

interface LogEntry {
  level: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  url?: string;
  userAgent?: string;
}

const buffer: LogEntry[] = [];
const BUFFER_MAX = 10;
const FLUSH_MS = 15000;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function enqueue(level: string, message: string, metadata?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    metadata,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
  buffer.push(entry);
  if (buffer.length >= BUFFER_MAX) flush();
  else if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
}

function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.length === 0) return;
  const toSend = [...buffer];
  buffer.length = 0;
  fetch(LOG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      logs: toSend,
      clientInfo: { url: window?.location?.href },
    }),
  }).catch(() => {});
}

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

export function initFrontendLogger() {
  console.log = (...args: unknown[]) => {
    originalLog.apply(console, args);
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    enqueue("INFO", msg);
  };
  console.warn = (...args: unknown[]) => {
    originalWarn.apply(console, args);
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    enqueue("WARN", msg);
    flush();
  };
  console.error = (...args: unknown[]) => {
    originalError.apply(console, args);
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    enqueue("ERROR", msg);
    flush();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flush);
  }
}
