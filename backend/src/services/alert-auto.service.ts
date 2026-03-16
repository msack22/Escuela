import type { PrismaClient } from "@prisma/client";
import { isEmailConfigured } from "../config.js";
import { emailNotifier } from "../infrastructure/email-notifier.js";
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

    const filtered = contests.filter((c) => {
      const depOk = !departments.length || departments.includes(c.school.department);
      const subjOk = !subjects.length || (c.subject && subjects.includes(c.subject.name));
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
    if (!email) continue;

    const subject = `[Concursos] ${toNotify.length} nuevo(s) concurso(s) para tus filtros`;
    const html = toNotify
      .map(
        (c) =>
          `<p><strong>${c.title}</strong><br/>${c.school?.city ?? ""} – ${c.school?.department ?? ""} | ${c.subject?.name ?? ""}</p>`,
      )
      .join("");

    let sent = false;
    if (isEmailConfigured()) {
      try {
        sent = await emailNotifier.send({ to: email, subject, html });
      } catch (err) {
        appLogger.error("AlertAuto → failed to send email", {
          alertId: alert.id,
          email,
          error: (err as Error)?.message ?? String(err),
        });
      }
    }

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
        email,
        contests: toNotify.map((c) => c.id),
      });
    }
  }

  return { alerts_processed: alerts.length, notifications_created: notificationsCreated };
}
