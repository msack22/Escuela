import type { PrismaClient } from "@prisma/client";
import { isEmailConfigured } from "../config.js";
import { emailNotifier } from "../infrastructure/email-notifier.js";
import { sendWhatsappMessage } from "../infrastructure/whatsapp-web-notifier.js";
import { appLogger } from "../lib/logger.js";

type ParsedPrefs = { subjects: string[]; departments: string[] };

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

export async function sendAutomaticContestNotifications(db: PrismaClient, since: Date) {
  const alerts = await db.alert.findMany({
    where: { is_active: true },
  });

  if (!alerts.length) {
    return { alerts_processed: 0, notifications_created: 0 };
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

  if (!contests.length) {
    appLogger.info("AlertAuto → no new contests since last run, skipping notifications");
    return { alerts_processed: alerts.length, notifications_created: 0 };
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

    if (!filtered.length) continue;

    const existing = await db.contestNotificationSent.findMany({
      where: {
        alert_id: alert.id,
        contest_id: { in: filtered.map((c) => c.id) },
      },
      select: { contest_id: true },
    });

    const alreadySentIds = new Set(existing.map((e) => e.contest_id));
    const toNotify = filtered.filter((c) => !alreadySentIds.has(c.id));
    if (!toNotify.length) continue;

    const user = alert.user_id ? await db.user.findUnique({ where: { id: alert.user_id } }) : null;
    const email = ((alert.email_address || user?.email) ?? "").trim();
    const whatsapp = ((alert.whatsapp_number || user?.phone_number) ?? "").trim();
    if (!email && !whatsapp) continue;

    const subject = `[Concursos] ${toNotify.length} nuevo(s) concurso(s) para tus filtros`;
    const html = toNotify
      .map(
        (c) =>
          `<p><strong>${c.title}</strong><br/>${c.school?.city ?? ""} – ${c.school?.department ?? ""} | ${c.subject?.name ?? ""}</p>`,
      )
      .join("");

    let emailSent = false;
    if (email && isEmailConfigured()) {
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

    const sent = emailSent || whatsappSent;
    if (sent) {
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
    }
  }

  return { alerts_processed: alerts.length, notifications_created: notificationsCreated };
}
