import type { PrismaClient } from "@prisma/client";
import { isEmailConfigured } from "../config.js";
import { emailNotifier } from "../infrastructure/email-notifier.js";
import { sendWhatsappMessage } from "../infrastructure/whatsapp-web-notifier.js";
import { appLogger } from "../lib/logger.js";

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
  const since = contestNotificationSince(runStartedAt);
  const alerts = await db.alert.findMany({
    where: { is_active: true },
  });

  if (!alerts.length) {
    appLogger.info("AlertAuto → no hay alertas activas, no se envía nada");
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
    },
  });

  appLogger.info("AlertAuto → ventana de concursos recientes", {
    since: since.toISOString(),
    runStartedAt:
      typeof runStartedAt === "number"
        ? new Date(runStartedAt).toISOString()
        : runStartedAt.toISOString(),
    contestsInWindow: contests.length,
    activeAlerts: alerts.length,
  });

  if (!contests.length) {
    appLogger.info(
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
      const subjName = norm(c.subject?.name);

      const depOk = !departmentSet.size || (schoolDep && departmentSet.has(schoolDep));
      const subjOk = !subjectSet.size || (subjName && subjectSet.has(subjName));
      return depOk && subjOk;
    });

    if (!filtered.length) {
      appLogger.info("AlertAuto → alerta sin concursos que coincidan con filtros", {
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
      appLogger.info("AlertAuto → concursos ya notificados antes para esta alerta", {
        alertId: alert.id,
        matchedInWindow: filtered.length,
      });
      continue;
    }

    const user = alert.user_id ? await db.user.findUnique({ where: { id: alert.user_id } }) : null;
    const email = ((alert.email_address || user?.email) ?? "").trim();
    const whatsapp = ((alert.whatsapp_number || user?.phone_number) ?? "").trim();
    if (!email && !whatsapp) {
      appLogger.warn("AlertAuto → alerta con concursos para avisar pero sin email ni WhatsApp", {
        alertId: alert.id,
        toNotifyCount: toNotify.length,
      });
      continue;
    }

    const subject = `[Concursos] ${toNotify.length} nuevo(s) concurso(s) para tus filtros`;
    const html = toNotify
      .map(
        (c) =>
          `<p><strong>${c.title}</strong><br/>${c.school?.city ?? ""} – ${c.school?.department ?? ""} | ${c.subject?.name ?? ""}</p>`,
      )
      .join("");

    let emailSent = false;
    if (email) {
      if (!isEmailConfigured()) {
        appLogger.warn("AlertAuto → email configurado en la alerta pero el servidor no tiene mail (Brevo/SendGrid)", {
          alertId: alert.id,
          email,
        });
      } else {
        try {
          emailSent = await emailNotifier.send({ to: email, subject, html });
        } catch (err) {
          appLogger.error("AlertAuto → failed to send email", {
            alertId: alert.id,
            email,
            error: (err as Error)?.message ?? String(err),
          });
        }
      }
    }

    let whatsappSent = false;
    if (whatsapp) {
      try {
        const formatDate = (d: Date | null) =>
          d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
        const lines = toNotify.map(
          (c) =>
            `• ${c.title} (${formatDate(c.publication_date ?? c.date)})\n  ${c.source_url}`
        );
        const preview = `[Concursos] ${toNotify.length} nuevo(s) concurso(s) para tus filtros:\n\n${lines.join("\n\n")}${email ? `\n\nTambién enviamos el detalle a ${email}.` : ""}`;
        whatsappSent = await sendWhatsappMessage(whatsapp, preview);
        if (whatsappSent) {
          appLogger.info("AlertAuto → WhatsApp sent for alert", { alertId: alert.id, whatsapp });
        }
      } catch (err) {
        appLogger.error("AlertAuto → failed to send WhatsApp", {
          alertId: alert.id,
          whatsapp,
          error: (err as Error)?.message ?? String(err),
        });
      }
    }

    // Guardamos como "notificado" si se pudo notificar por AL MENOS un canal.
    // Esto evita re-enviar el mismo lote por email si WhatsApp falla (o viceversa).
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

      appLogger.info("AlertAuto → notifications sent for alert", {
        alertId: alert.id,
        email: email || null,
        whatsapp: whatsapp || null,
        emailSent,
        whatsappSent,
        contests: toNotify.map((c) => c.id),
      });

      if ((!!email && !emailSent) || (!!whatsapp && !whatsappSent)) {
        appLogger.warn(
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
      appLogger.warn(
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
