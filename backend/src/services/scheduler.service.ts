const AVAILABLE_SOURCES = ["cge_simple", "cge_enterios_completo", "datos_abiertos_argentina", "puntos_digitales"];

let isRunning = false;
let lastRun: string | null = null;
let nextRun: string | null = null;
let cycleProgress: { running: boolean; step?: string; source?: string; percentage?: number; current?: number; total?: number } = { running: false };

export const schedulerService = {
  getStatus() {
    return {
      is_running: isRunning,
      last_run: lastRun,
      next_run: nextRun,
      available_sources: AVAILABLE_SOURCES,
      job_count: 0,
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
  },
  setLastRun(date: string | null) {
    lastRun = date;
  },
  getAvailableSources() {
    return AVAILABLE_SOURCES;
  },
};
