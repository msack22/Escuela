import { prisma } from "../db.js";
import { runCgeScraper } from "../scrapers/cge-scraper.js";
import { runFacebookCgeScraper } from "../scrapers/facebook-cge-scraper.js";
import { runCgeApiScraper, LEVELS_SKIP } from "../scrapers/cge-api-scraper.js";
import { appLogger } from "../lib/logger.js";
import { sendAutomaticContestNotifications } from "./alert-auto.service.js";
import { sendDailyDigest } from "./digest.service.js";
import { emailNotifier } from "../infrastructure/email-notifier.js";
import { sendWhatsappMessage } from "../infrastructure/whatsapp-web-notifier.js";
import { config, isEmailConfigured } from "../config.js";

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

// Alerta al admin si el scraping automático falla varias veces seguidas (ej: caída de
// internet/wifi del servidor, o la API de CGE caída por horas). Evita enterarse recién
// varios días después de que dejaron de llegar concursos nuevos.
const CONSECUTIVE_FAILURES_ALERT_THRESHOLD = 2;
const FAILURE_ALERT_COOLDOWN_MS = 3 * 60 * 60 * 1000; // no repetir la alerta antes de 3hs
let consecutiveScrapingFailures = 0;
let lastFailureAlertAt = 0;

async function alertAdminScrapingFailing(errorMsg: string, failureCount: number) {
  const to = config.ADMIN_EMAIL;
  const whatsapp = config.ADMIN_WHATSAPP;
  const subject = `⚠️ Scraping de concursos falla hace ${failureCount} corridas seguidas`;
  const text = `El scraping automático de concursos (Escuela) lleva ${failureCount} corridas seguidas fallando.\n\nÚltimo error: ${errorMsg}\n\nRevisar conectividad del servidor o si la API del CGE está caída.`;
  try {
    if (to && isEmailConfigured()) {
      await emailNotifier.send({ to, subject, html: `<p>${text.replace(/\n/g, "<br/>")}</p>` });
    }
    if (whatsapp) {
      await sendWhatsappMessage(whatsapp, `🔴 ${subject}\n\n${text}`);
    }
    appLogger.info("Scheduler → alerta de scraping caído enviada al admin", { failureCount });
  } catch (err) {
    appLogger.error("Scheduler → no se pudo enviar alerta de scraping caído", {
      error: (err as Error)?.message ?? String(err),
    });
  }
}

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
      id: r.id,
      started_at: r.started_at.toISOString(),
      finished_at: r.finished_at.toISOString(),
      timezone: r.timezone,
      hour_ar: r.hour_ar,
      sources: r.sources.split(","),
      total_contests: r.total_contests,
      fetched_total: (r as any).fetched_total ?? 0,
      cgeCount: r.cge_count,
      facebookCount: r.facebook_count,
    }));
  },
  // Desglose por motivo de descarte de una corrida puntual: permite ver, para
  // una fila del historial, qué concursos se filtraron y por qué (incluye los
  // descartes por palabra clave de nivel, que no se reflejan en fetched_total).
  async getRunDiscardedBreakdown(runId: number) {
    const run = await prisma.schedulerRun.findUnique({ where: { id: runId } });
    if (!run) return null;

    const posts = await prisma.discardedPost.findMany({
      where: { scheduler_run_id: runId },
      orderBy: { discarded_at: "asc" },
    });

    const byReason = new Map<string, typeof posts>();
    for (const p of posts) {
      const arr = byReason.get(p.reason) ?? [];
      arr.push(p);
      byReason.set(p.reason, arr);
    }

    return {
      run: {
        id: run.id,
        started_at: run.started_at.toISOString(),
        finished_at: run.finished_at.toISOString(),
        hour_ar: run.hour_ar,
        sources: run.sources.split(","),
        fetched_total: run.fetched_total,
        total_contests: run.total_contests,
      },
      excluded_levels: [...LEVELS_SKIP],
      groups: [...byReason.entries()].map(([reason, items]) => ({
        reason,
        count: items.length,
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          url: i.url,
          keyword_matched: i.keyword_matched,
          post_date: i.post_date ? i.post_date.toISOString() : null,
          discarded_at: i.discarded_at.toISOString(),
        })),
      })),
    };
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

  // Se crea la fila ANTES de correr los scrapers (con finished_at como
  // placeholder) para tener el id disponible y poder linkear cada
  // discarded_post a la corrida que lo generó.
  const schedulerRun = await prisma.schedulerRun.create({
    data: {
      started_at: startedAt,
      finished_at: startedAt,
      timezone: TIMEZONE,
      hour_ar: currentHourAr,
      sources: autoSources.join(","),
    },
  });

  try {
    let apiCreated = 0;
    let apiFetched = 0;
    let cgeCount = 0;
    let fbCount = 0;

    if (autoSources.includes("cge_api")) {
      const result = await runCgeApiScraper(prisma, schedulerRun.id);
      apiCreated = result.created;
      apiFetched = result.fetched;
    }
    if (autoSources.includes("cge_simple") || autoSources.includes("cge_enterios_completo")) {
      cgeCount = await runCgeScraper(prisma);
    }
    if (autoSources.includes("facebook_cge")) {
      fbCount = await runFacebookCgeScraper(prisma);
    }

    const total = apiCreated + cgeCount + fbCount;

    jobCount += 1;
    lastRun = startedAt.toISOString();
    nextRun = computeNextRun(startedAt);

    const finishedAt = new Date();
    await prisma.schedulerRun.update({
      where: { id: schedulerRun.id },
      data: {
        finished_at: finishedAt,
        total_contests: total,
        cge_count: cgeCount,
        facebook_count: fbCount,
        fetched_total: apiFetched,
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
    consecutiveScrapingFailures = 0;
  } catch (err) {
    const errorMsg = (err as Error)?.message ?? String(err);
    appLogger.error("Scheduler → automatic scraping cycle failed", { error: errorMsg });
    consecutiveScrapingFailures++;
    const now = Date.now();
    if (
      consecutiveScrapingFailures >= CONSECUTIVE_FAILURES_ALERT_THRESHOLD &&
      now - lastFailureAlertAt > FAILURE_ALERT_COOLDOWN_MS
    ) {
      lastFailureAlertAt = now;
      await alertAdminScrapingFailing(errorMsg, consecutiveScrapingFailures);
    }
  } finally {
    schedulerService.setCycleProgress({ running: false });
    isJobExecuting = false;
  }
}, 60_000);

// Digest diario: se ejecuta una vez al día a las 7 hs AR.
const DIGEST_HOUR_AR = 7;
let lastDigestDateKey: string | null = null;

setInterval(async () => {
  if (!isRunning) return;
  const now = new Date();
  const { dateKey, hour } = getArgentinaLocalParts(now);
  if (hour !== DIGEST_HOUR_AR) return;
  if (now.getMinutes() > 5) return;
  const digestSlot = `digest-${dateKey}`;
  if (digestSlot === lastDigestDateKey) return;
  lastDigestDateKey = digestSlot;
  appLogger.info("Scheduler → ejecutando digest diario", { dateKey, hour });
  try {
    const result = await sendDailyDigest(prisma);
    appLogger.info("Scheduler → digest diario finalizado", result);
  } catch (err) {
    appLogger.error("Scheduler → error en digest diario", { error: (err as Error)?.message ?? String(err) });
  }
}, 60_000);
