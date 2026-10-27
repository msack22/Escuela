import type { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { runCgeScraper } from "../scrapers/cge-scraper.js";
import { runFacebookCgeScraper } from "../scrapers/facebook-cge-scraper.js";
import { runCgeApiScraper, CgeApiUnavailableError } from "../scrapers/cge-api-scraper.js";
import { schedulerService } from "../services/scheduler.service.js";
import { sendAutomaticContestNotifications, sendMissedContestNotifications } from "../services/alert-auto.service.js";
import { importPadronEscuelas, extractCueFromText, lookupCue, lookupByName } from "../services/padron-escuelas.service.js";
import { extractContestFieldsFromText } from "../services/contest-text-parser.js";
import { normalizeSubjectName, getItemType, getSubjectGroupName } from "../lib/subject-normalizer.js";
import { appLogger } from "../lib/logger.js";

export async function runScraperBySource(
  prisma: PrismaClient,
  source: string,
): Promise<{ count: number; success: boolean; error?: string }> {
  appLogger.info("Scraping → runScraperBySource called", { source });

  // Ejecutar todos los scrapers conocidos
  if (source === "all") {
    let total = 0;

    appLogger.info("Scraping → running CGE API scraper (all)");
    try {
      const { created: apiCount } = await runCgeApiScraper(prisma);
      total += apiCount;
      appLogger.info("Scraping → CGE API scraper finished", { apiCount });
    } catch (err) {
      if (err instanceof CgeApiUnavailableError) {
        appLogger.warn("Scraping → CGE API no disponible, usando fallback HTML scraper", { error: err.message });
        const fallbackCount = await runCgeScraper(prisma);
        total += fallbackCount;
        appLogger.info("Scraping → CGE HTML fallback finished", { fallbackCount });
        const fbCount = await runFacebookCgeScraper(prisma);
        total += fbCount;
        appLogger.info("Scraping → Facebook fallback finished", { fbCount });
      } else {
        throw err;
      }
    }

    appLogger.info("Scraping → all scrapers finished", { total });
    return { count: total, success: true };
  }

  if (source === "cge_api") {
    try {
      const { created } = await runCgeApiScraper(prisma);
      return { count: created, success: true };
    } catch (err) {
      if (err instanceof CgeApiUnavailableError) {
        appLogger.warn("Scraping → CGE API no disponible, usando fallback HTML scraper", { error: err.message });
        const fallbackCount = await runCgeScraper(prisma);
        const fbCount = await runFacebookCgeScraper(prisma);
        return { count: fallbackCount + fbCount, success: true };
      }
      throw err;
    }
  }

  // Scrapers legacy — mantenidos como backup
  if (source === "cge_simple" || source === "cge_enterios_completo") {
    const count = await runCgeScraper(prisma);
    return { count, success: true };
  }
  if (source === "facebook_cge") {
    const count = await runFacebookCgeScraper(prisma);
    return { count, success: true };
  }
  if (source === "datos_abiertos_argentina" || source === "puntos_digitales") {
    return { count: 0, success: true };
  }
  return { count: 0, success: false, error: "Unknown source" };
}

export const scrapingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/status", async () => {
    const st = schedulerService.getStatus();
    return { ...st, status: st.is_running ? "running" : "idle" };
  });

  app.get("/progress", async () => {
    const cycle = schedulerService.getCycleProgress();
    if (cycle.running) {
      return { running: true, source: cycle.source ?? "scheduler", step: cycle.step ?? "Scraping...", percentage: cycle.percentage, current: cycle.current, total: cycle.total };
    }
    return { running: false, step: "", percentage: null, source: null };
  });

  // Endpoint SSE compatible con el backend Python: /api/scraping/progress/stream
  app.get("/progress/stream", async (req, reply) => {
    // Headers SSE
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const send = () => {
      const cycle = schedulerService.getCycleProgress();
      const payload = cycle.running
        ? {
            running: true,
            source: cycle.source ?? "scheduler",
            step: cycle.step ?? "Scraping...",
            percentage: cycle.percentage,
            current: cycle.current,
            total: cycle.total,
          }
        : {
            running: false,
            step: "",
            percentage: null,
            source: null,
          };
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // Enviar inmediatamente un estado inicial
    send();
    const interval = setInterval(send, 2000);

    req.raw.on("close", () => {
      clearInterval(interval);
      reply.raw.end();
    });
  });

  app.get<{ Querystring: { limit?: string } }>("/logs", async (req) => {
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit ?? "50", 10) || 50));
    const logs = await req.server.prisma.scrapingLog.findMany({ take: limit, orderBy: { started_at: "desc" } });
    return { logs };
  });

  app.post("/start", async () => {
    if (schedulerService.getStatus().is_running) return { message: "Scheduler is already running" };
    schedulerService.setRunning(true);
    return { message: "Scheduler started successfully" };
  });

  app.post("/stop", async () => {
    schedulerService.setRunning(false);
    return { message: "Scheduler stopped successfully" };
  });

  app.post<{ Body?: { source?: string; sources?: string[]; send_notifications?: boolean } }>("/run", async (req, reply) => {
    const body = req.body ?? {};
    const sources: string[] =
      Array.isArray(body.sources) && body.sources.length > 0
        ? body.sources
        : body.source
          ? [body.source]
          : ["all"];
    const sendNotifications = body.send_notifications !== false;

    const start = Date.now();
    schedulerService.setCycleProgress({
      running: true,
      step: `Scraping ${sources.join(", ")}...`,
      source: sources.join(","),
    });

    try {
      const results: { source: string; count: number; success: boolean; error?: string }[] = [];

      for (const src of sources) {
        const { count, success, error } = await runScraperBySource(req.server.prisma, src);
        const elapsed = (Date.now() - start) / 1000;

        results.push({ source: src, count, success, error });

        await req.server.prisma.scrapingLog.create({
          data: {
            source_name: src,
            status: success ? "success" : "error",
            contests_found: count,
            contests_processed: count,
            error_message: error ?? null,
            execution_time_seconds: elapsed,
            finished_at: new Date(),
          },
        });
      }

      const totalCount = results.reduce((acc, r) => acc + r.count, 0);
      const anyError = results.some((r) => !r.success);
      const elapsedTotal = (Date.now() - start) / 1000;
      const notifSummary = sendNotifications
        ? await sendAutomaticContestNotifications(req.server.prisma, start)
        : { alerts_processed: 0, notifications_created: 0, skipped: true };

      schedulerService.setLastRun(new Date().toISOString());
      schedulerService.setCycleProgress({ running: false });

      return {
        success: !anyError,
        contests_found: totalCount,
        execution_time_seconds: elapsedTotal,
        results,
        notifications: notifSummary,
        send_notifications: sendNotifications,
        message: !anyError
          ? `Scraping ${sources.join(", ")} finalizado`
          : "Scraping finalizado con errores en alguna fuente",
      };
    } catch (e) {
      const err = e as Error;
      const elapsedSeconds = (Date.now() - start) / 1000;
      schedulerService.setCycleProgress({ running: false });

      appLogger.error("Scraping /run failed", {
        sources,
        error_name: err.name,
        error_message: err.message,
        error_stack: err.stack ?? null,
        execution_time_seconds: elapsedSeconds,
      });

      await req.server.prisma.scrapingLog.create({
        data: {
          source_name: sources.join(","),
          status: "error",
          contests_found: 0,
          contests_processed: 0,
          error_message: err.message,
          execution_time_seconds: elapsedSeconds,
          finished_at: new Date(),
        },
      });

      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  app.post("/run-datos-abiertos", async (req, reply) => {
    const start = Date.now();
    try {
      const { count } = await runScraperBySource(req.server.prisma, "datos_abiertos_argentina");
      return { message: "Scraping de Datos Abiertos Argentina finalizado", total_datasets: count, scraped_at: new Date().toISOString(), source: "datos_abiertos_argentina" };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  app.post("/run-puntos-digitales", async (req, reply) => {
    try {
      await runScraperBySource(req.server.prisma, "puntos_digitales");
      return { message: "Scraping de Puntos Digitales finalizado", total_capacitaciones: 0, scraped_at: new Date().toISOString(), source: "puntos_digitales" };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  // Health check: llama a la API del CGE y devuelve cuántos posts encontró sin guardar nada
  app.get("/cge-health", async (_req, reply) => {
    try {
      const now = new Date();
      const afterDate = new Date(now.getFullYear(), 0, 1).toISOString(); // desde el 1 ene del año actual
      const beforeDate = new Date(now.getTime() + 86_400_000).toISOString(); // hasta mañana
      const { data } = await (await import("axios")).default.get(
        "https://cge.entrerios.gov.ar/wp-json/wp/v2/posts",
        {
          params: { per_page: 10, page: 1, after: afterDate, before: beforeDate, orderby: "date", order: "desc", _fields: "id,date,link,title" },
          timeout: 15_000,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; EscuelaCGEScraper/1.0)", "Accept": "application/json" },
        }
      );
      const sample = Array.isArray(data) ? data.slice(0, 3).map((p: any) => ({ id: p.id, date: p.date, title: p.title?.rendered?.slice(0, 80) })) : [];
      return { ok: true, posts_sample_count: Array.isArray(data) ? data.length : 0, sample, checked_at: now.toISOString() };
    } catch (e) {
      return reply.status(502).send({ ok: false, error: (e as Error).message, checked_at: new Date().toISOString() });
    }
  });

  app.post("/run-cge-simple", async (req, reply) => {
    try {
      const { created } = await runCgeApiScraper(req.server.prisma);
      return { message: "Scraping CGE Entre Ríos finalizado", total_contests: created, scraped_at: new Date().toISOString(), source: "cge_api", contests: [] };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  app.post("/run-cge-completo", async (req, reply) => {
    try {
      const { created } = await runCgeApiScraper(req.server.prisma);
      return { message: "Scraping CGE Entre Ríos finalizado", total_contests: created, scraped_at: new Date().toISOString(), source: "cge_api" };
    } catch (e) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  // Envía todos los concursos activos no notificados según los filtros de cada alerta
  app.post("/notify-missed", async (req, reply) => {
    try {
      const result = await sendMissedContestNotifications(req.server.prisma);
      return { success: true, ...result };
    } catch (e) {
      return reply.status(500).send({ success: false, error: (e as Error).message });
    }
  });

  // Descarga e importa el padrón oficial de establecimientos educativos en la DB
  app.post("/import-padron", async (req, reply) => {
    const logs: string[] = [];
    reply.send({ success: true, message: "Importando padrón en background, revisá los logs" });
    importPadronEscuelas(req.server.prisma, (msg) => logs.push(msg))
      .then((r) => appLogger.info("import-padron: completado", r))
      .catch((err) => appLogger.error("import-padron: error", { error: (err as Error).message }));
  });

  // Re-procesa con regex + CUE lookup las escuelas sin departamento/ciudad y actualiza sus datos
  app.post("/fix-missing-departments", async (req, reply) => {
    const prisma = req.server.prisma;

    // Detecta departamento a partir del texto de la descripción del concurso.
    // Prioridad: patrones DDE/DRE explícitos → localidades → ciudades cabecera.
    function detectDeptFromText(text: string): { department: string; city?: string } | null {
      const DEPT_PATTERNS: Array<{ dept: string; city?: string; patterns: RegExp[] }> = [
        { dept: "Paraná", city: "Paraná",       patterns: [/dptal\.?\s*pn[áa]\.?/i, /dde\s+paran[áa]\b/i, /d\.d\.e\.?\s*paran[áa]\b/i, /\bcrespo\b/i, /\bhasenkamp\b/i, /\bmar[ií]a\s+grande\b/i, /\bvill[ao]\s+libertad[oa]r\b.*san\s+mart[ií]n/i] },
        { dept: "Concordia", city: "Concordia", patterns: [/dde\s+concordia\b/i, /d\.d\.e\.?\s*concordia\b/i, /[–\-]\s*concordia\b/i, /\bconcordia\b.*(?:concurs|llama|convoc)/i, /(?:concurs|llama|convoc).*\bconcordia\b/i, /\byeruá\b/i, /\bnu[eé]va\s+escocesa\b/i] },
        { dept: "Federación", city: "Federación", patterns: [/dde\s+federaci[oó]n\b/i, /d\.d\.e\.?\s*federac\b/i, /\bchaj[aá]r[ií]\b/i, /\bsan\s+jaime\b/i, /\bsanta\s+ana\b.*entre\s+r[ií]os/i, /\bfederaci[oó]n\b.*(?:concurs|llama|convoc)/i] },
        { dept: "Federal",     city: "Federal",   patterns: [/dde\s+federal\b/i, /d\.d\.e\.?\s*federal\b/i, /\bsauce\s+de\s+luna\b/i, /\bfederal\b.*(?:concurs|llama|convoc)/i] },
        { dept: "Villaguay",   city: "Villaguay", patterns: [/dde\s+villaguay\b/i, /d\.d\.e\.?\s*villaguay\b/i, /\bvillaguay\b/i, /\baldea\s+san\s+antonio\b/i, /\bcuchilla\s+redonda\b/i, /\bberisso\b/i] },
        { dept: "Colón",       city: "Colón",     patterns: [/dde\s+col[oó]n\b/i, /d\.d\.e\.?\s*col[oó]n\b/i, /\bvilla\s+elisa\b/i, /\bsan\s+jos[eé]\b.*entre\s+r[ií]os/i, /[–\-]\s*col[oó]n\b/i, /\bpuerto\s+yeru[aá]\b/i, /\blas\s+cuevas\b.*col[oó]n/i] },
        { dept: "San Salvador", city: "San Salvador", patterns: [/san\s+salvador\b/i, /dde\s+san\s+salv/i, /\bgeneral\s+campos\b/i, /\bubajay\b/i, /\bsan\s+gustavo\b/i] },
        { dept: "Gualeguay",   city: "Gualeguay", patterns: [/dde\s+gualeguay\b/i, /d\.d\.e\.?\s*gualeguay\b/i, /\burdinarrain\b/i, /\blarroque\b/i, /\bgualeguay\b.*(?:concurs|llama|convoc)/i] },
        { dept: "Uruguay",     city: "Concepción del Uruguay", patterns: [/dde\s+uruguay\b/i, /d\.d\.e\.?\s*uruguay\b/i, /\bconcepci[oó]n\s+del\s+uruguay\b/i, /\bcolonia\s+el[ií]as\b/i, /\bcolonia\s+larroque\b/i] },
        { dept: "La Paz",      city: "La Paz",    patterns: [/dde\s+la\s+paz\b/i, /d\.d\.e\.?\s*la\s+paz\b/i, /\bbovril\b/i, /\bsanta\s+elena\b.*entre\s+r[ií]os/i, /\bel\s+solar\b/i, /\bla\s+paz\b.*(?:concurs|llama|convoc)/i] },
        { dept: "Nogoyá",      city: "Nogoyá",    patterns: [/dde\s+nogoy[aá]\b/i, /\bnogoy[aá]\b/i, /\baranguren\b/i, /\bvilla\s+hern[aá]ndez\b/i, /\bgeneral\s+alvear\b.*entre\s+r[ií]os/i] },
        { dept: "Tala",        city: "Rosario del Tala", patterns: [/dde\s+tala\b/i, /d\.d\.e\.?\s*tala\b/i, /\brosario\s+del\s+tala\b/i, /\bmaci[aá]\b/i, /\bvilla\s+clara\b.*tala/i, /\bgobernador\s+mansilla\b/i] },
        { dept: "Diamante",    city: "Diamante",  patterns: [/dde\s+diamante\b/i, /d\.d\.e\.?\s*diamante\b/i, /\bdiamante\b.*(?:concurs|llama|convoc)/i, /[–\-]\s*diamante\b/i] },
        { dept: "Victoria",    city: "Victoria",  patterns: [/dde\s+victoria\b/i, /d\.d\.e\.?\s*victoria\b/i, /\bvictoria\b.*(?:concurs|llama|convoc)/i, /[–\-]\s*victoria\b/i] },
        { dept: "Feliciano",   city: "San José de Feliciano", patterns: [/dde\s+feliciano\b/i, /d\.d\.e\.?\s*feliciano\b/i, /\bsan\s+jos[eé]\s+de\s+feliciano\b/i, /\bfeliciano\b/i] },
        { dept: "Gualeguaychú", city: "Gualeguaychú", patterns: [/dde\s+gualeguaych[uú]\b/i, /d\.d\.e\.?\s*gualeguaych/i, /\bgualeguaych[uú]\b/i] },
        { dept: "Islas del Ibicuy", city: "Villa Paranacito", patterns: [/dde\s+ibicuy\b/i, /\bislas\s+del\s+ibicuy\b/i, /\bvilla\s+paranacito\b/i, /\bibicuy\b/i, /\bceibas\b/i, /\bmazaruca\b/i] },
      ];

      for (const entry of DEPT_PATTERNS) {
        if (entry.patterns.some((re) => re.test(text))) {
          // Try to extract specific city from text (localidad de X)
          const localidad = text.match(/localidad\s+de\s+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñüÁÉÍÓÚÑÜ\s.]+?)(?:[,\n\-–]|$)/)?.[1]?.trim();
          return { department: entry.dept, city: localidad || entry.city };
        }
      }
      return null;
    }

    const schools = await prisma.school.findMany({
      where: { department: "Sin departamento" },
      select: { id: true, name: true },
    });

    reply.send({ success: true, schools_to_process: schools.length, message: "Procesando en background, revisá los logs" });

    (async () => {
      let updated = 0, skipped = 0;

      for (const school of schools) {
        try {
          const contest = await prisma.contest.findFirst({
            where: { school_id: school.id, description: { not: null } },
            select: { description: true, source_url: true },
            orderBy: [{ id: "desc" }],
          });
          const content = contest?.description?.trim() ?? "";

          const sourceUrl = contest?.source_url ?? "";

          // 1) regex sobre la URL del post (keywords de departamento)
          let detected = detectDeptFromText(sourceUrl.toLowerCase().replace(/-/g, " "));

          // 2) regex sobre el texto de la descripción
          if (!detected && content.length >= 30) detected = detectDeptFromText(content);

          // 3) buscar CUE en el texto y consultar el padrón
          if (!detected) {
            const cue = content.length >= 5 ? extractCueFromText(content) : null;
            if (cue) {
              const padron = await lookupCue(prisma, cue);
              if (padron) detected = { department: padron.departamento, city: padron.localidad };
            }
          }

          // 4) buscar por nombre de escuela en el padrón (único match = seguro)
          if (!detected) {
            const padron = await lookupByName(prisma, school.name);
            if (padron) detected = { department: padron.departamento, city: padron.localidad };
          }

          if (!detected) { skipped++; continue; }

          await prisma.school.update({
            where: { id: school.id },
            data: { department: detected.department, city: detected.city ?? detected.department },
          });
          updated++;
          appLogger.info("fix-missing-departments: escuela actualizada", { schoolId: school.id, name: school.name, ...detected });
        } catch (err) {
          appLogger.warn("fix-missing-departments: error en escuela", { schoolId: school.id, error: (err as Error).message });
          skipped++;
        }
      }
      appLogger.info("fix-missing-departments: completado", { total: schools.length, updated, skipped });
    })().catch((err) => appLogger.error("fix-missing-departments: error general", { error: (err as Error).message }));
  });

  /**
   * POST /api/scraping/reparse-items
   * Re-extrae materias de los concursos con subject="General" o subjects mal parseados,
   * usando la descripción almacenada en DB sin necesidad de re-scrapear URLs.
   */
  app.post("/reparse-items", async () => {
    const prisma = app.prisma as PrismaClient;
    // Procesar: subject="General" + subjects que parecen texto de contenido (no una materia real)
    const allContests = await prisma.contest.findMany({
      select: { id: true, title: true, description: true, subject: { select: { name: true } } },
    });
    const GARBAGE_PATTERN = /\b(solicitar[aá]|deber[aá]n|credencial|presentar(se)?|aspirante|establecimiento|instituc|convoc|matricul|concurso|ascenso|descenso|vacante|jubilaci[oó]n|reemplazo)\b|\d+o\d+o/i;
    const contests = allContests.filter(c =>
      c.subject.name === "General" ||
      (c.subject.name.length > 40 && !normalizeSubjectName(c.subject.name)) ||
      c.subject.name.includes(":") ||       // etiquetas tipo "CARGO O:" — no son materias
      GARBAGE_PATTERN.test(c.subject.name)
    );
    appLogger.info("reparse-items: iniciando", { total: contests.length });

    ;(async () => {
      let updated = 0, skipped = 0;
      for (const contest of contests) {
        try {
          if (!contest.description) { skipped++; continue; }

          const fields = extractContestFieldsFromText({ title: contest.title, description: contest.description });
          if (fields.items.length === 0 || (fields.items.length === 1 && !fields.items[0].subjectName)) {
            skipped++;
            continue;
          }

          // Upsert subjects y armar items resueltos
          const resolvedItems: {
            subjectId: number; subjectName: string; hoursToCover: number | null;
            itemType: string; grade: string | null; llamado: string | null; caracter: string | null;
          }[] = [];
          for (const item of fields.items) {
            const rawName = item.subjectName ?? "";
            const normalized = normalizeSubjectName(rawName);
            const name = (normalized ?? rawName.slice(0, 80)).trim();
            // Descartar si el nombre tiene aspecto de texto-de-contenido y no es materia canónica.
            const looksLikeGarbage = !normalized && (
              rawName.length > 60 ||
              GARBAGE_PATTERN.test(rawName) ||
              rawName.includes(":") ||           // etiqueta tipo "CARGO O:" — no es materia
              /^(cátedras?\s+|sección\s+)/i.test(rawName) ||
              /\b([oó]rdenes?\s+de\s+m[eé]ritos?|ampliator)/i.test(rawName)
            );
            if (!name || name === "General" || looksLikeGarbage) { skipped++; continue; }
            const normalizedGroup = getSubjectGroupName(name);
            const upserted = await prisma.subject.upsert({
              where: { name },
              create: { name, normalized_name: normalizedGroup },
              update: { normalized_name: normalizedGroup },
            });
            resolvedItems.push({
              subjectId: upserted.id, subjectName: name,
              hoursToCover: item.hoursToCover ?? null,
              itemType: getItemType(name),
              grade: item.grade?.slice(0, 80) ?? null,
              llamado: item.llamado?.slice(0, 60) ?? null,
              caracter: item.caracter?.slice(0, 100) ?? null,
            });
          }
          if (resolvedItems.length === 0) {
            // Si el subject actual es basura (tiene ":" o matchea GARBAGE_PATTERN),
            // lo reseteamos a "General" para no seguir ciclando en futuros reparseos.
            const currentSubject = contest.subject.name;
            const isCurrentGarbage = currentSubject.includes(":") || GARBAGE_PATTERN.test(currentSubject);
            if (isCurrentGarbage) {
              const generalSubject = await prisma.subject.upsert({ where: { name: "General" }, create: { name: "General" }, update: {} });
              await prisma.$transaction(async (tx) => {
                await tx.contestItem.deleteMany({ where: { contest_id: contest.id } });
                await tx.contest.update({ where: { id: contest.id }, data: { subject_id: generalSubject.id } });
              });
              appLogger.info("reparse-items: reseteado a General", { contestId: contest.id, prevSubject: currentSubject });
            }
            skipped++;
            continue;
          }

          await prisma.$transaction(async (tx) => {
            // Reemplazar items existentes
            await tx.contestItem.deleteMany({ where: { contest_id: contest.id } });
            await tx.contestItem.createMany({
              data: resolvedItems.map((ri) => ({
                contest_id: contest.id, subject_id: ri.subjectId,
                hours_to_cover: ri.hoursToCover, grade: ri.grade,
                llamado: ri.llamado, caracter: ri.caracter, item_type: ri.itemType,
              })),
            });
            // Actualizar contest principal con el primer item
            await tx.contest.update({
              where: { id: contest.id },
              data: { subject_id: resolvedItems[0].subjectId, hours_to_cover: resolvedItems[0].hoursToCover },
            });
          });
          updated++;
          appLogger.info("reparse-items: actualizado", { contestId: contest.id, items: resolvedItems.map(r => r.subjectName) });
        } catch (err) {
          appLogger.warn("reparse-items: error", { contestId: contest.id, error: (err as Error).message });
          skipped++;
        }
      }
      appLogger.info("reparse-items: completado", { total: contests.length, updated, skipped });
    })().catch((err) => appLogger.error("reparse-items: error general", { error: (err as Error).message }));

    return { success: true, queued: contests.length, message: "Re-parseo iniciado en background" };
  });

  /**
   * POST /api/scraping/rebuild-normalized-names
   * Recalcula normalized_name para todos los subjects según el mapeo actual.
   */
  app.post("/rebuild-normalized-names", async () => {
    const prisma = app.prisma as PrismaClient;
    const subjects = await prisma.subject.findMany({ select: { id: true, name: true } });
    let updated = 0;
    for (const s of subjects) {
      const normalized = getSubjectGroupName(s.name);
      await prisma.subject.update({ where: { id: s.id }, data: { normalized_name: normalized } });
      updated++;
    }
    appLogger.info("rebuild-normalized-names: completado", { updated });
    return { success: true, updated };
  });
};
