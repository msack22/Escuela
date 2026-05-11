import type { PrismaClient } from "@prisma/client";
import { isEmailConfigured } from "../config.js";
import { emailNotifier } from "../infrastructure/email-notifier.js";
import { sendWhatsappMessage } from "../infrastructure/whatsapp-web-notifier.js";
import { alertsApiLogger } from "../lib/logger.js";

type ParsedPrefs = { subjects: string[]; departments: string[] };

/** Inicio “seguro” para created_at: margen por desfase reloj DB / DateTime(0) y para no perder inserts del mismo segundo que el POST. */
const NOTIFICATION_SINCE_BUFFER_MS = 120_000;

export function contestNotificationSince(runStart: Date | number): Date {
  const ms = typeof runStart === "number" ? runStart : runStart.getTime();
  return new Date(Math.max(0, ms - NOTIFICATION_SINCE_BUFFER_MS));
}

function parsePreferences(raw: string | null): ParsedPrefs {
  if (!raw) return { subjects: [], departments: [] };

  try {
    const parsed = JSON.parse(raw);

    // Formato viejo: ["Matemática", "Lengua"]
    if (Array.isArray(parsed)) {
      return { subjects: parsed.filter((x) => typeof x === "string"), departments: [] };
    }

    // Formato nuevo: { subjects: [...], departments: [...] }
    const anyParsed = parsed as any;
    const subjects = Array.isArray(anyParsed.subjects)
      ? anyParsed.subjects.filter((x: unknown) => typeof x === "string")
      : [];
    const departments = Array.isArray(anyParsed.departments)
      ? anyParsed.departments.filter((x: unknown) => typeof x === "string")
      : [];

    return { subjects, departments };
  } catch {
    return { subjects: [], departments: [] };
  }
}

export async function sendAutomaticContestNotifications(db: PrismaClient, runStartedAt: Date | number) {
  const formatDateTime = (d: Date | null) =>
    d
      ? new Date(d).toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const since = contestNotificationSince(runStartedAt);
  const alerts = await db.alert.findMany({
    where: { is_active: true },
  });

  if (!alerts.length) {
    alertsApiLogger.info("AlertAuto → no hay alertas activas, no se envía nada");
    return { alerts_processed: 0, notifications_created: 0, reason: "no_active_alerts" as const };
  }

  const contests = await db.contest.findMany({
    where: {
      created_at: { gte: since },
      is_active: true,
    },
    include: {
      school: true,
      subject: true,
      items: { include: { subject: true } },
    },
  });

  alertsApiLogger.info("AlertAuto → ventana de concursos recientes", {
    since: since.toISOString(),
    runStartedAt:
      typeof runStartedAt === "number"
        ? new Date(runStartedAt).toISOString()
        : runStartedAt.toISOString(),
    contestsInWindow: contests.length,
    activeAlerts: alerts.length,
  });

  if (!contests.length) {
    alertsApiLogger.info(
      "AlertAuto → ningún concurso con created_at en la ventana (¿0 creados en este scraping o ya existían?)",
    );
    return {
      alerts_processed: alerts.length,
      notifications_created: 0,
      reason: "no_contests_in_window" as const,
    };
  }

  let notificationsCreated = 0;

  for (const alert of alerts) {
    const { subjects, departments } = parsePreferences(alert.subject_preferences);

    // Normalizamos para comparación case-insensitive (y tolerar mayúsculas/minúsculas distintas).
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const subjectSet =
      subjects && subjects.length ? new Set(subjects.map((s) => norm(s))) : new Set<string>();
    const departmentSet =
      departments && departments.length ? new Set(departments.map((d) => norm(d))) : new Set<string>();

    const filtered = contests.filter((c) => {
      const schoolDep = norm(c.school?.department);
      const depOk = !departmentSet.size || (schoolDep && departmentSet.has(schoolDep));
      if (!depOk) return false;
      if (!subjectSet.size) return true;

      // Usar items si existen (datos nuevos), si no caer en contest.subject (datos viejos)
      const subjectNames = c.items.length > 0
        ? c.items.map((item) => norm(item.subject?.name))
        : [norm(c.subject?.name)];

      return subjectNames.some((sn) => sn && subjectSet.has(sn));
    });

    if (!filtered.length) {
      alertsApiLogger.info("AlertAuto → alerta sin concursos que coincidan con filtros", {
        alertId: alert.id,
        filterDepartments: [...departmentSet],
        filterSubjects: [...subjectSet],
        sampleFromWindow: contests.slice(0, 5).map((c) => ({
          id: c.id,
          schoolDept: c.school?.department ?? null,
          subject: c.subject?.name ?? null,
          source: c.source_name,
        })),
      });
      continue;
    }

    const existing = await db.contestNotificationSent.findMany({
      where: {
        alert_id: alert.id,
        contest_id: { in: filtered.map((c) => c.id) },
      },
      select: { contest_id: true },
    });

    const alreadySentIds = new Set(existing.map((e) => e.contest_id));
    const toNotify = filtered.filter((c) => !alreadySentIds.has(c.id));
    if (!toNotify.length) {
      alertsApiLogger.info("AlertAuto → concursos ya notificados antes para esta alerta", {
        alertId: alert.id,
        matchedInWindow: filtered.length,
      });
      continue;
    }

    const user = alert.user_id ? await db.user.findUnique({ where: { id: alert.user_id } }) : null;
    const email = ((alert.email_address || user?.email) ?? "").trim();
    const whatsapp = ((alert.whatsapp_number || user?.phone_number) ?? "").trim();
    if (!email && !whatsapp) {
      alertsApiLogger.warn("AlertAuto → alerta con concursos para avisar pero sin email ni WhatsApp", {
        alertId: alert.id,
        toNotifyCount: toNotify.length,
      });
      continue;
    }

    const subject = `[Concursos] ${toNotify.length} nuevo(s) concurso(s) para tus filtros`;

    const formatItemsHtml = (c: (typeof toNotify)[number]) => {
      const anyC = c as any;
      if (Array.isArray(anyC.items) && anyC.items.length > 0) {
        return anyC.items
          .map((item: any) => {
            const label = item.item_type === "cargo" ? "Cargo" : "Materia";
            const hrs = item.hours_to_cover ? ` – ${item.hours_to_cover} hs` : "";
            return `${label}: ${item.subject?.name ?? "—"}${hrs}`;
          })
          .join("<br/>");
      }
      return `Materia/Cargo: ${c.subject?.name ?? "—"}`;
    };

    const formatItemsText = (c: (typeof toNotify)[number]) => {
      const anyC = c as any;
      if (Array.isArray(anyC.items) && anyC.items.length > 0) {
        return anyC.items
          .map((item: any) => {
            const label = item.item_type === "cargo" ? "Cargo" : "Materia";
            const hrs = item.hours_to_cover ? ` – ${item.hours_to_cover} hs` : "";
            return `  ${label}: ${item.subject?.name ?? "—"}${hrs}`;
          })
          .join("\n");
      }
      return `  Materia/Cargo: ${c.subject?.name ?? "—"}`;
    };

    const html = toNotify
      .map(
        (c, i) =>
          `<p><strong>${i + 1}. ${c.title}</strong><br/>` +
          `Fecha concurso: ${formatDateTime(c.date)}<br/>` +
          formatItemsHtml(c) + `<br/>` +
          `${c.school?.city ?? ""} – ${c.school?.department ?? ""}<br/>` +
          `<a href="${c.source_url ?? ""}">Ver fuente</a></p>`,
      )
      .join("");

    let emailSent = false;
    if (email) {
      if (!isEmailConfigured()) {
        alertsApiLogger.warn("AlertAuto → email configurado en la alerta pero el servidor no tiene mail (Brevo/SendGrid)", {
          alertId: alert.id,
          email,
        });
      } else {
        try {
          emailSent = await emailNotifier.send({ to: email, subject, html });
        } catch (err) {
          alertsApiLogger.error("AlertAuto → failed to send email", {
            alertId: alert.id,
            email,
            error: (err as Error)?.message ?? String(err),
          });
        }
      }
    }

    let whatsappSent = false;
    if (whatsapp) {
      const lines = toNotify.map(
        (c, i) =>
          `${i + 1}. ${c.title}\n` +
          `  Fecha concurso: ${formatDateTime(c.date)}\n` +
          formatItemsText(c) + `\n` +
          `  ${c.source_url}`
      );
      const preview = `[Concursos] ${toNotify.length} nuevo(s) concurso(s) para tus filtros:\n\n${lines.join("\n\n")}${email ? `\n\nTambién enviamos el detalle a ${email}.` : ""}`;
      const WA_MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= WA_MAX_ATTEMPTS && !whatsappSent; attempt++) {
        if (attempt > 1) await new Promise((r) => setTimeout(r, 5_000));
        try {
          whatsappSent = await sendWhatsappMessage(whatsapp, preview);
          if (whatsappSent) {
            alertsApiLogger.info("AlertAuto → WhatsApp sent for alert", { alertId: alert.id, whatsapp, attempt });
          } else if (attempt < WA_MAX_ATTEMPTS) {
            alertsApiLogger.warn("AlertAuto → WhatsApp falló, reintentando", { alertId: alert.id, attempt });
          }
        } catch (err) {
          alertsApiLogger.error("AlertAuto → failed to send WhatsApp", {
            alertId: alert.id,
            whatsapp,
            attempt,
            error: (err as Error)?.message ?? String(err),
          });
        }
      }
    }

    const sentAny = emailSent || whatsappSent;

    if (sentAny) {
      await db.contestNotificationSent.createMany({
        data: toNotify.map((c) => ({
          alert_id: alert.id,
          contest_id: c.id,
        })),
        skipDuplicates: true,
      });
      notificationsCreated += toNotify.length;

      alertsApiLogger.info("AlertAuto → notifications sent for alert", {
        alertId: alert.id,
        email: email || null,
        whatsapp: whatsapp || null,
        emailSent,
        whatsappSent,
        contests: toNotify.map((c) => c.id),
      });

      if ((!!email && !emailSent) || (!!whatsapp && !whatsappSent)) {
        alertsApiLogger.warn(
          "AlertAuto → se notificó por al menos un canal, pero otro falló (no se reintentará para estos concursos)",
          {
            alertId: alert.id,
            email: email || null,
            whatsapp: whatsapp || null,
            emailSent,
            whatsappSent,
            toNotifyCount: toNotify.length,
          },
        );
      }
    } else {
      alertsApiLogger.warn(
        "AlertAuto → había concursos para notificar pero no se envió ni mail ni WhatsApp (no se marca como notificado)",
        {
          alertId: alert.id,
          toNotifyCount: toNotify.length,
          hadEmail: !!email,
          hadWhatsapp: !!whatsapp,
          emailConfigured: isEmailConfigured(),
          emailSent,
          whatsappSent,
        },
      );
    }
  }

  return { alerts_processed: alerts.length, notifications_created: notificationsCreated };
}
