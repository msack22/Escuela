import type { PrismaClient } from "@prisma/client";
import { isEmailConfigured } from "../config.js";
import { emailNotifier } from "../infrastructure/email-notifier.js";
import { sendWhatsappMessage } from "../infrastructure/whatsapp-web-notifier.js";
import { alertsApiLogger } from "../lib/logger.js";

function parsePreferences(raw: string | null): { subjects: string[]; departments: string[]; excluded_subjects: string[] } {
  if (!raw) return { subjects: [], departments: [], excluded_subjects: [] };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { subjects: parsed.filter((x) => typeof x === "string"), departments: [], excluded_subjects: [] };
    return {
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      departments: Array.isArray(parsed.departments) ? parsed.departments : [],
      excluded_subjects: Array.isArray(parsed.excluded_subjects) ? parsed.excluded_subjects : [],
    };
  } catch { return { subjects: [], departments: [], excluded_subjects: [] }; }
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const capFirst = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—";

const formatDateTime = (d: Date | null) =>
  d ? new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function formatItemsHtml(items: any[]): string {
  if (!items.length) return "<strong>Materia/Cargo:</strong> —";
  return items.map((item: any) => {
    const label = item.item_type === "cargo" ? "Cargo" : "Materia";
    const hrs = item.hours_to_cover ? ` – ${item.hours_to_cover} hs` : "";
    const grado = item.grade ? ` (${item.grade})` : "";
    return `<strong>${label}:</strong> ${capFirst(item.subject?.name ?? "—")}${hrs}${grado}`;
  }).join("<br/>");
}

function formatItemsText(items: any[]): string {
  if (!items.length) return "*Materia/Cargo*: —";
  return items.map((item: any) => {
    const label = item.item_type === "cargo" ? "Cargo" : "Materia";
    const hrs = item.hours_to_cover ? ` – ${item.hours_to_cover} hs` : "";
    const grado = item.grade ? ` (${item.grade})` : "";
    return `*${label}*: ${capFirst(item.subject?.name ?? "—")}${hrs}${grado}`;
  }).join("\n");
}

/** Envía un resumen diario a todas las alertas con digest_mode=true.
 *  Incluye todos los concursos activos no notificados que coincidan con los filtros. */
export async function sendDailyDigest(db: PrismaClient) {
  const alerts = await db.alert.findMany({ where: { is_active: true, digest_mode: true } });
  if (!alerts.length) {
    alertsApiLogger.info("Digest → no hay alertas con digest_mode activo");
    return { alerts_processed: 0, notifications_created: 0 };
  }

  const contests = await db.contest.findMany({
    where: { is_active: true },
    include: { school: true, subject: true, items: { include: { subject: true } } },
    orderBy: { date: "asc" },
  });

  alertsApiLogger.info("Digest → ejecutando digest diario", { alerts: alerts.length, contests: contests.length });

  let notificationsCreated = 0;

  for (const alert of alerts) {
    const { subjects, departments, excluded_subjects } = parsePreferences(alert.subject_preferences);
    const subjectSet = subjects.length ? new Set(subjects.map(norm)) : new Set<string>();
    const excludedSet = excluded_subjects.length ? new Set(excluded_subjects.map(norm)) : new Set<string>();
    const departmentSet = departments.length ? new Set(departments.map(norm)) : new Set<string>();

    const subjectMatches = (item: any, set: Set<string>) => {
      const name = norm(item.subject?.name);
      const group = norm(item.subject?.normalized_name ?? item.subject?.name);
      return set.has(name) || set.has(group);
    };

    const contestsWithItems = contests
      .filter((c) => !departmentSet.size || departmentSet.has(norm(c.school?.department)))
      .map((c) => {
        let items = c.items.length > 0 ? [...c.items] : (c.subject ? [{ ...c, subject: c.subject, hours_to_cover: null, item_type: "subject" } as any] : []);
        if (excludedSet.size) items = items.filter((item: any) => !subjectMatches(item, excludedSet));
        if (subjectSet.size) items = items.filter((item: any) => subjectMatches(item, subjectSet));
        return { contest: c, visibleItems: items };
      })
      .filter(({ visibleItems }) => visibleItems.length > 0);

    if (!contestsWithItems.length) continue;

    const existing = await db.contestNotificationSent.findMany({
      where: { alert_id: alert.id, contest_id: { in: contestsWithItems.map(({ contest: c }) => c.id) } },
      select: { contest_id: true },
    });
    const alreadySentIds = new Set(existing.map((e) => e.contest_id));
    const toNotifyWithItems = contestsWithItems.filter(({ contest: c }) => !alreadySentIds.has(c.id));

    if (!toNotifyWithItems.length) {
      alertsApiLogger.info("Digest → sin novedades para esta alerta", { alertId: alert.id });
      continue;
    }

    const toNotify = toNotifyWithItems.map(({ contest: c }) => c);
    const user = alert.user_id ? await db.user.findUnique({ where: { id: alert.user_id } }) : null;
    const email = ((alert.email_address || user?.email) ?? "").trim();
    const whatsapp = ((alert.whatsapp_number || user?.phone_number) ?? "").trim();

    if (!email && !whatsapp) continue;

    const emailSubject = `[Resumen diario] ${toNotify.length} concurso(s) disponibles`;

    const html =
      `<p><strong>Resumen diario de concursos</strong> — ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</p>` +
      `<p>Hay <strong>${toNotify.length}</strong> concurso(s) que coinciden con tus filtros:</p>` +
      toNotifyWithItems.map(({ contest: c, visibleItems }, i) => {
        const schoolLine = c.school ? `${c.school.name} · ${c.school.city} (${c.school.department})` : "";
        const turno = c.shift ? `<strong>Turno:</strong> ${c.shift}<br/>` : "";
        return (
          `<p><strong>${i + 1}. ${c.title}</strong><br/>` +
          `<strong>📅 Fecha:</strong> ${formatDateTime(c.date)}<br/>` +
          (schoolLine ? `<strong>🏫 Escuela:</strong> ${schoolLine}<br/>` : "") +
          turno +
          formatItemsHtml(visibleItems) + `<br/>` +
          `<a href="${c.source_url ?? ""}">🔗 Ver publicación en CGE</a></p>`
        );
      }).join("") +
      `<hr/><p style="font-size:12px;color:#888">Para desactivar este resumen respondé PARAR por WhatsApp o modificá tu alerta en el sistema.</p>`;

    let emailSent = false;
    if (email && isEmailConfigured()) {
      try { emailSent = await emailNotifier.send({ to: email, subject: emailSubject, html }); }
      catch (err) { alertsApiLogger.error("Digest → error email", { alertId: alert.id, error: (err as Error).message }); }
    }

    let whatsappSent = false;
    if (whatsapp) {
      const lines = toNotifyWithItems.map(({ contest: c, visibleItems }, i) => {
        const schoolLine = c.school ? `🏫 ${c.school.name} · ${c.school.city}` : "";
        const turnoLine = c.shift ? `Turno: ${c.shift}` : "";
        const parts = [
          `${i + 1}. *${c.title}*`,
          `📅 Fecha: ${formatDateTime(c.date)}`,
          schoolLine,
          turnoLine,
          formatItemsText(visibleItems),
          `🔗 ${c.source_url ?? ""}`,
        ].filter(Boolean);
        return parts.join("\n");
      });
      const waText = `📋 *Resumen diario de concursos* (${toNotify.length} nuevo${toNotify.length !== 1 ? "s" : ""}):\n\n${lines.join("\n\n")}`;
      for (let attempt = 1; attempt <= 3 && !whatsappSent; attempt++) {
        if (attempt > 1) await new Promise((r) => setTimeout(r, 5_000));
        whatsappSent = await sendWhatsappMessage(whatsapp, waText);
      }
    }

    if (emailSent || whatsappSent) {
      await db.contestNotificationSent.createMany({
        data: toNotify.map((c) => ({ alert_id: alert.id, contest_id: c.id })),
        skipDuplicates: true,
      });
      notificationsCreated += toNotify.length;
      alertsApiLogger.info("Digest → enviado", { alertId: alert.id, count: toNotify.length, emailSent, whatsappSent });
    }
  }

  return { alerts_processed: alerts.length, notifications_created: notificationsCreated };
}
