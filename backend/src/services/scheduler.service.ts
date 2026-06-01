import { prisma } from "../db.js";
import { runCgeScraper } from "../scrapers/cge-scraper.js";
import { runFacebookCgeScraper } from "../scrapers/facebook-cge-scraper.js";
import { runCgeApiScraper } from "../scrapers/cge-api-scraper.js";
import { appLogger } from "../lib/logger.js";
import { sendAutomaticContestNotifications } from "./alert-auto.service.js";

// Fuentes que el usuario puede elegir explícitamente desde el frontend.
// "all" se maneja como valor implícito cuando no se envía ninguna fuente.
const AVAILABLE_SOURCES = ["cge_api"];

// Zona horaria fija para el scheduler: horario de Argentina.
const TIMEZONE = "America/Argentina/Buenos_Aires";

// Configuración por defecto del scheduler automático.
let scheduledHours: number[] = [8, 12, 16, 20]; // 8, 12, 16 y 20 hs AR
let autoSources: string[] = ["cge_api"];

let isRunning = false;
let lastRun: string | null = null;
let nextRun: string | null = null;
let jobCount = 0;
let cycleProgress: { running: boolean; step?: string; source?: string; percentage?: number; current?: number; total?: number } = { running: false };

// Para evitar ejecuciones duplicadas dentro del mismo bloque horario.
let lastScheduledSlotKey: string | null = null;
let isJobExecuting = false;

type SchedulerRunInfo = {
  started_at: string;
  finished_at: string;
  timezone: string;
  hour_ar: number;
  sources: string[];
  total_contests: number;
  cgeCount: number;
  facebookCount: number;
};


function getArgentinaLocalParts(d: Date): { dateKey: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "00";
  const hour = Number.parseInt(hourStr, 10) || 0;
  const dateKey = `${year}-${month}-${day}`;
  return { dateKey, hour };
}

function computeSlotKey(d: Date): string {
  const { dateKey, hour } = getArgentinaLocalParts(d);
  return `${dateKey}-${hour}`;
}

function computeNextRun(from: Date): string {
  const { dateKey, hour } = getArgentinaLocalParts(from);
  const sortedHours = [...scheduledHours].sort((a, b) => a - b);

  for (const h of sortedHours) {
    if (h > hour) {
      const [y, m, d] = dateKey.split("-").map((v) => Number.parseInt(v, 10));
      const candidate = new Date(Date.UTC(y, m - 1, d, h + 3, 0, 0)); // AR ~ UTC-3
      return candidate.toISOString();
    }
  }

  const [y, m, d] = dateKey.split("-").map((v) => Number.parseInt(v, 10));
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
  const candidate = new Date(tomorrow.getTime());
  candidate.setUTCHours(scheduledHours[0] + 3, 0, 0, 0);
  return candidate.toISOString();
}

export const schedulerService = {
  getStatus() {
    return {
      is_running: isRunning,
      last_run: lastRun,
      next_run: nextRun,
      available_sources: AVAILABLE_SOURCES,
      job_count: jobCount,
      timezone: TIMEZONE,
      scheduled_hours: [...scheduledHours],
      auto_sources: [...autoSources],
    };
  },
  getCycleProgress() {
    return { ...cycleProgress };
  },
  setCycleProgress(p: typeof cycleProgress) {
    cycleProgress = p;
  },
  setRunning(r: boolean) {
    isRunning = r;
    appLogger.info("Scheduler → running flag updated", { isRunning: r });
  },
  setLastRun(date: string | null) {
    lastRun = date;
  },
  getAvailableSources() {
    return AVAILABLE_SOURCES;
  },
  getConfig() {
    return {
      timezone: TIMEZONE,
      scheduled_hours: [...scheduledHours],
      auto_sources: [...autoSources],
    };
  },
  updateConfig(partial: { scheduled_hours?: number[]; auto_sources?: string[] }) {
    if (partial.scheduled_hours && partial.scheduled_hours.length > 0) {
      scheduledHours = Array.from(new Set(partial.scheduled_hours.filter((h) => h >= 0 && h < 24))).sort(
        (a, b) => a - b,
      );
    }
    if (partial.auto_sources && partial.auto_sources.length > 0) {
      autoSources = partial.auto_sources.filter((s) => AVAILABLE_SOURCES.includes(s));
    }
  },
  async getHistory(limit = 20) {
    const rows = await prisma.schedulerRun.findMany({
      orderBy: { started_at: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      started_at: r.started_at.toISOString(),
      finished_at: r.finished_at.toISOString(),
      timezone: r.timezone,
      hour_ar: r.hour_ar,
      sources: r.sources.split(","),
      total_contests: r.total_contests,
      cgeCount: r.cge_count,
      facebookCount: r.facebook_count,
    }));
  },
};

// Bucle sencillo de scheduler en memoria: se ejecuta cada minuto y,
// si el scheduler está activo, dispara el scraping en los horarios configurados.
setInterval(async () => {
  if (!isRunning || isJobExecuting) return;

  const now = new Date();
  const { hour: currentHourAr } = getArgentinaLocalParts(now);

  if (!scheduledHours.includes(currentHourAr)) {
    return;
  }

  // Ejecutamos solo en los primeros minutos de la hora para reducir duplicados.
  if (now.getMinutes() > 5) {
    return;
  }

  const slotKey = computeSlotKey(now);
  if (slotKey === lastScheduledSlotKey) {
    return;
  }

  isJobExecuting = true;
  lastScheduledSlotKey = slotKey;

  const startedAt = new Date();
  schedulerService.setCycleProgress({
    running: true,
    step: "Scheduler automático ejecutando scraping (CGE API)...",
    source: autoSources.join(","),
  });

  appLogger.info("Scheduler → starting automatic scraping cycle", {
    scheduledAt: startedAt.toISOString(),
    hour_ar: currentHourAr,
    sources: autoSources,
  });

  try {
    let apiCount = 0;
    let cgeCount = 0;
    let fbCount = 0;

    if (autoSources.includes("cge_api")) {
      apiCount = await runCgeApiScraper(prisma);
    }
    if (autoSources.includes("cge_simple") || autoSources.includes("cge_enterios_completo")) {
      cgeCount = await runCgeScraper(prisma);
    }
    if (autoSources.includes("facebook_cge")) {
      fbCount = await runFacebookCgeScraper(prisma);
    }

    const total = apiCount + cgeCount + fbCount;

    jobCount += 1;
    lastRun = startedAt.toISOString();
    nextRun = computeNextRun(startedAt);

    const finishedAt = new Date();
    await prisma.schedulerRun.create({
      data: {
        started_at: startedAt,
        finished_at: finishedAt,
        timezone: TIMEZONE,
        hour_ar: currentHourAr,
        sources: autoSources.join(","),
        total_contests: total,
        cge_count: cgeCount,
        facebook_count: fbCount,
      },
    });
    const runInfo: SchedulerRunInfo = {
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      timezone: TIMEZONE,
      hour_ar: currentHourAr,
      sources: [...autoSources],
      total_contests: total,
      cgeCount,
      facebookCount: fbCount,
    };

    // Enviar notificaciones automáticas para concursos nuevos desde que empezó este ciclo.
    // IMPORTANTE: debe ejecutarse antes de marcar inactivos, porque algunos concursos recién
    // scrapeados pueden tener una fecha pasada (fecha de publicación del CGE) y quedarían
    // excluidos del filtro is_active: true antes de que se pueda notificar.
    const notifSummary = await sendAutomaticContestNotifications(prisma, startedAt);

    // Marcar concursos pasados como inactivos
    const deactivated = await prisma.contest.updateMany({
      where: { is_active: true, date: { lt: new Date() } },
      data: { is_active: false },
    });
    if (deactivated.count > 0) {
      appLogger.info("Scheduler → concursos pasados marcados como inactivos", { count: deactivated.count });
    }

    appLogger.info("Scheduler → automatic scraping cycle finished", {
      total,
      cgeCount,
      fbCount,
      lastRun,
      nextRun,
      jobCount,
      runInfo,
      notifications: notifSummary,
    });
  } catch (err) {
    appLogger.error("Scheduler → automatic scraping cycle failed", {
      error: (err as Error)?.message ?? String(err),
    });
  } finally {
    schedulerService.setCycleProgress({ running: false });
    isJobExecuting = false;
  }
}, 60_000);
