import type { PrismaClient } from "@prisma/client";
import { isEmailConfigured } from "../config.js";
import { emailNotifier } from "../infrastructure/email-notifier.js";
import { sendWhatsappMessage } from "../infrastructure/whatsapp-web-notifier.js";
import { alertsApiLogger } from "../lib/logger.js";

type ParsedPrefs = { subjects: string[]; departments: string[]; excluded_subjects: string[] };

/** Inicio “seguro” para created_at: margen por desfase reloj DB / DateTime(0) y para no perder inserts del mismo segundo que el POST. */
const NOTIFICATION_SINCE_BUFFER_MS = 120_000;

export function contestNotificationSince(runStart: Date | number): Date {
  const ms = typeof runStart === "number" ? runStart : runStart.getTime();
  return new Date(Math.max(0, ms - NOTIFICATION_SINCE_BUFFER_MS));
}

function parsePreferences(raw: string | null): ParsedPrefs {
  if (!raw) return { subjects: [], departments: [], excluded_subjects: [] };

  try {
    const parsed = JSON.parse(raw);

    // Formato viejo: ["Matemática", "Lengua"]
    if (Array.isArray(parsed)) {
      return { subjects: parsed.filter((x) => typeof x === "string"), departments: [], excluded_subjects: [] };
    }

    // Formato nuevo: { subjects: [...], departments: [...], excluded_subjects: [...] }
    const anyParsed = parsed as any;
    const subjects = Array.isArray(anyParsed.subjects)
      ? anyParsed.subjects.filter((x: unknown) => typeof x === "string")
      : [];
    const departments = Array.isArray(anyParsed.departments)
      ? anyParsed.departments.filter((x: unknown) => typeof x === "string")
      : [];
    const excluded_subjects = Array.isArray(anyParsed.excluded_subjects)
      ? anyParsed.excluded_subjects.filter((x: unknown) => typeof x === "string")
      : [];

    return { subjects, departments, excluded_subjects };
  } catch {
    return { subjects: [], departments: [], excluded_subjects: [] };
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
      parent_contest_id: null,   // excluir ampliatorias (el padre ya fue notificado)
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
    const { subjects, departments, excluded_subjects } = parsePreferences(alert.subject_preferences);

    // Normalizamos para comparación case-insensitive (y tolerar mayúsculas/minúsculas distintas).
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const subjectSet =
      subjects && subjects.length ? new Set(subjects.map((s) => norm(s))) : new Set<string>();
    const excludedSet =
      excluded_subjects && excluded_subjects.length ? new Set(excluded_subjects.map((s) => norm(s))) : new Set<string>();
    const departmentSet =
      departments && departments.length ? new Set(departments.map((d) => norm(d))) : new Set<string>();

    // Para cada concurso, calculamos los ítems visibles después de aplicar include/exclude
    type ContestWithVisibleItems = { contest: typeof contests[number]; visibleItems: typeof contests[number]["items"] };
    const contestsWithItems: ContestWithVisibleItems[] = contests
      .filter((c) => {
        const schoolDep = norm(c.school?.department);
        return !departmentSet.size || (schoolDep && departmentSet.has(schoolDep));
      })
      .map((c) => {
        // Usar items si existen (datos nuevos), si no usar el subject del concurso como ítem único
        let items = c.items.length > 0 ? [...c.items] : (c.subject ? [{ ...c, subject: c.subject, hours_to_cover: null, item_type: "subject" } as any] : []);

        // Determina si un item coincide con un conjunto de nombres/grupos
        const subjectMatches = (item: any, set: Set<string>) => {
          const name = norm(item.subject?.name);
          const group = norm(item.subject?.normalized_name ?? item.subject?.name);
          return set.has(name) || set.has(group);
        };

        // 1. Excluir materias que el usuario no quiere (por nombre exacto o grupo)
        if (excludedSet.size) {
          items = items.filter((item: any) => !subjectMatches(item, excludedSet));
        }

        // 2. Si hay lista de "quiero", filtrar solo esas (por nombre exacto o grupo)
        if (subjectSet.size) {
          items = items.filter((item: any) => subjectMatches(item, subjectSet));
        }

        return { contest: c, visibleItems: items };
      })
      .filter(({ visibleItems }) => visibleItems.length > 0);

    const filtered = contestsWithItems.map(({ contest }) => contest);

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

    const capFirst = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—";

    const formatItemsHtml = (items: any[]) => {
      if (items.length > 0) {
        return items
          .map((item: any) => {
            const label = item.item_type === "cargo" ? "Cargo" : "Materia";
            const hrs = item.hours_to_cover ? ` – ${item.hours_to_cover} hs` : "";
            const grado = item.grade ? ` (${item.grade})` : "";
            return `<strong>${label}:</strong> ${capFirst(item.subject?.name ?? "—")}${hrs}${grado}`;
          })
          .join("<br/>");
      }
      return `<strong>Materia/Cargo:</strong> —`;
    };

    const formatItemsText = (items: any[]) => {
      if (items.length > 0) {
        return items
          .map((item: any) => {
            const label = item.item_type === "cargo" ? "Cargo" : "Materia";
            const hrs = item.hours_to_cover ? ` – ${item.hours_to_cover} hs` : "";
            const grado = item.grade ? ` (${item.grade})` : "";
            return `*${label}*: ${capFirst(item.subject?.name ?? "—")}${hrs}${grado}`;
          })
          .join("\n");
      }
      return `*Materia/Cargo*: —`;
    };

    const html = toNotify
      .map((c, i) => {
        const visibleItems = contestsWithItems.find(({ contest }) => contest.id === c.id)?.visibleItems ?? (c as any).items;
        const schoolLine = c.school
          ? `${c.school.name} · ${c.school.city} (${c.school.department})`
          : "";
        const turno = c.shift ? `<strong>Turno:</strong> ${c.shift}<br/>` : "";
        return (
          `<p><strong>${i + 1}. ${c.title}</strong><br/>` +
          `<strong>📅 Fecha:</strong> ${formatDateTime(c.date)}<br/>` +
          (schoolLine ? `<strong>🏫 Escuela:</strong> ${schoolLine}<br/>` : "") +
          turno +
          formatItemsHtml(visibleItems) + `<br/>` +
          `<a href="${c.source_url ?? ""}">🔗 Ver publicación en CGE</a></p>`
        );
      })
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
      const lines = toNotify.map((c, i) => {
        const visibleItems = contestsWithItems.find(({ contest }) => contest.id === c.id)?.visibleItems ?? (c as any).items;
        const schoolLine = c.school ? `🏫 ${c.school.name} · ${c.school.city}` : "";
        const turnoLine = c.shift ? `Turno: ${c.shift}` : "";
        const parts = [
          `${i + 1}. *${c.title}*`,
          `📅 Fecha: ${formatDateTime(c.date)}`,
          schoolLine,
          turnoLine,
          formatItemsText(visibleItems),
          `🔗 ${c.source_url}`,
        ].filter(Boolean);
        return parts.join("\n");
      });
      const detailed = `🔔 *[Concursos]* ${toNotify.length} nuevo(s) concurso(s) para tus filtros:\n\n${lines.join("\n\n")}${email ? `\n\nTambién enviamos el detalle a ${email}.` : ""}`;
      // La API de Meta rechaza mensajes de más de 4096 caracteres (Param text.body must be
      // at most 4096 characters long). Con muchos concursos en un solo envío el detalle
      // completo puede superarlo, así que se manda un resumen corto en ese caso.
      const WA_TEXT_LIMIT = 4000;
      const preview = detailed.length <= WA_TEXT_LIMIT
        ? detailed
        : `🔔 *[Concursos]* Hay ${toNotify.length} concurso(s) nuevos para tus filtros.${email ? `\nTe enviamos el detalle completo a ${email}.` : " Ingresá a la app para verlos."}`;
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

/** Envía todos los concursos activos que coinciden con los filtros de cada alerta
 *  pero que todavía NO fueron notificados (sin restricción de ventana temporal). */
export async function sendMissedContestNotifications(db: PrismaClient) {
  const formatDateTime = (d: Date | null) =>
    d
      ? new Date(d).toLocaleString("es-AR", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "—";

  const alerts = await db.alert.findMany({ where: { is_active: true } });
  if (!alerts.length) {
    alertsApiLogger.info("MissedNotif → no hay alertas activas");
    return { alerts_processed: 0, notifications_created: 0 };
  }

  const contests = await db.contest.findMany({
    where: { is_active: true, parent_contest_id: null },
    include: { school: true, subject: true, items: { include: { subject: true } } },
    orderBy: { publication_date: "desc" },
  });

  alertsApiLogger.info("MissedNotif → concursos activos totales", { total: contests.length, alerts: alerts.length });

  let notificationsCreated = 0;

  for (const alert of alerts) {
    const { subjects, departments, excluded_subjects } = parsePreferences(alert.subject_preferences);
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const subjectSet = subjects.length ? new Set(subjects.map(norm)) : new Set<string>();
    const excludedSet = excluded_subjects.length ? new Set(excluded_subjects.map(norm)) : new Set<string>();
    const departmentSet = departments.length ? new Set(departments.map(norm)) : new Set<string>();

    type ContestWithItems = { contest: typeof contests[number]; visibleItems: typeof contests[number]["items"] };
    const contestsWithItems: ContestWithItems[] = contests
      .filter((c) => !departmentSet.size || departmentSet.has(norm(c.school?.department)))
      .map((c) => {
        let items = c.items.length > 0 ? [...c.items] : (c.subject ? [{ ...c, subject: c.subject, hours_to_cover: null, item_type: "subject" } as any] : []);
        const subjectMatchesMissed = (item: any, set: Set<string>) => {
          const name = norm(item.subject?.name);
          const group = norm(item.subject?.normalized_name ?? item.subject?.name);
          return set.has(name) || set.has(group);
        };
        if (excludedSet.size) items = items.filter((item: any) => !subjectMatchesMissed(item, excludedSet));
        if (subjectSet.size) items = items.filter((item: any) => subjectMatchesMissed(item, subjectSet));
        return { contest: c, visibleItems: items };
      })
      .filter(({ visibleItems }) => visibleItems.length > 0);

    if (!contestsWithItems.length) {
      alertsApiLogger.info("MissedNotif → alerta sin coincidencias", { alertId: alert.id });
      continue;
    }

    const existing = await db.contestNotificationSent.findMany({
      where: { alert_id: alert.id, contest_id: { in: contestsWithItems.map(({ contest: c }) => c.id) } },
      select: { contest_id: true },
    });
    const alreadySentIds = new Set(existing.map((e) => e.contest_id));
    const toNotifyWithItems = contestsWithItems.filter(({ contest: c }) => !alreadySentIds.has(c.id));

    if (!toNotifyWithItems.length) {
      alertsApiLogger.info("MissedNotif → todos los concursos ya notificados para esta alerta", { alertId: alert.id });
      continue;
    }

    const toNotify = toNotifyWithItems.map(({ contest: c }) => c);
    const user = alert.user_id ? await db.user.findUnique({ where: { id: alert.user_id } }) : null;
    const email = ((alert.email_address || user?.email) ?? "").trim();
    const whatsapp = ((alert.whatsapp_number || user?.phone_number) ?? "").trim();

    if (!email && !whatsapp) {
      alertsApiLogger.warn("MissedNotif → sin email ni WhatsApp para esta alerta", { alertId: alert.id });
      continue;
    }

    alertsApiLogger.info("MissedNotif → enviando a alerta", { alertId: alert.id, count: toNotify.length, email, whatsapp });

    const emailSubject = `[Concursos] ${toNotify.length} concurso(s) disponibles para tus filtros`;

    const capFirstM = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—";

    const formatItemsHtml = (items: any[]) =>
      items.length
        ? items.map((item: any) => {
            const label = item.item_type === "cargo" ? "Cargo" : "Materia";
            const hrs = item.hours_to_cover ? ` – ${item.hours_to_cover} hs` : "";
            const grado = item.grade ? ` (${item.grade})` : "";
            return `<strong>${label}:</strong> ${capFirstM(item.subject?.name ?? "—")}${hrs}${grado}`;
          }).join("<br/>")
        : "<strong>Materia/Cargo:</strong> —";

    const html =
      `<p>Hay <strong>${toNotify.length}</strong> concurso(s) que coinciden con tus filtros y aún no fueron notificados:</p>` +
      toNotifyWithItems
        .map(({ contest: c, visibleItems }, i) => {
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
        })
        .join("");

    let emailSent = false;
    if (email && isEmailConfigured()) {
      try {
        emailSent = await emailNotifier.send({ to: email, subject: emailSubject, html });
      } catch (err) {
        alertsApiLogger.error("MissedNotif → error enviando email", { alertId: alert.id, error: (err as Error).message });
      }
    }

    let whatsappSent = false;
    if (whatsapp) {
      let waText: string;
      const WA_INLINE_LIMIT = 30;
      if (toNotify.length <= WA_INLINE_LIMIT) {
        const lines = toNotifyWithItems.map(({ contest: c, visibleItems }, i) => {
          const itemsText = visibleItems.length
            ? visibleItems.map((item: any) => {
                const label = item.item_type === "cargo" ? "Cargo" : "Materia";
                const hrs = item.hours_to_cover ? ` – ${item.hours_to_cover} hs` : "";
                const grado = item.grade ? ` (${item.grade})` : "";
                return `*${label}*: ${capFirstM(item.subject?.name ?? "—")}${hrs}${grado}`;
              }).join("\n")
            : "*Materia/Cargo*: —";
          const schoolLine = c.school ? `🏫 ${c.school.name} · ${c.school.city}` : "";
          const turnoLine = c.shift ? `Turno: ${c.shift}` : "";
          const parts = [
            `${i + 1}. *${c.title}*`,
            `📅 Fecha: ${formatDateTime(c.date)}`,
            schoolLine,
            turnoLine,
            itemsText,
            `🔗 ${c.source_url ?? ""}`,
          ].filter(Boolean);
          return parts.join("\n");
        });
        waText = `🔔 *[Concursos]* ${toNotify.length} concurso(s) para tus filtros:\n\n${lines.join("\n\n")}${email ? `\n\nDetalle completo enviado a ${email}.` : ""}`;
      } else {
        waText = `🔔 *[Concursos]* Hay ${toNotify.length} concurso(s) nuevos para tus filtros.${email ? `\nTe enviamos el detalle completo a ${email}.` : " Ingresá a la app para verlos."}`;
      }
      const WA_MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= WA_MAX_ATTEMPTS && !whatsappSent; attempt++) {
        if (attempt > 1) await new Promise((r) => setTimeout(r, 5_000));
        whatsappSent = await sendWhatsappMessage(whatsapp, waText);
        if (!whatsappSent && attempt < WA_MAX_ATTEMPTS)
          alertsApiLogger.warn("MissedNotif → WhatsApp falló, reintentando", { alertId: alert.id, attempt });
      }
    }

    if (emailSent || whatsappSent) {
      await db.contestNotificationSent.createMany({
        data: toNotify.map((c) => ({ alert_id: alert.id, contest_id: c.id })),
        skipDuplicates: true,
      });
      notificationsCreated += toNotify.length;
      alertsApiLogger.info("MissedNotif → notificaciones enviadas", { alertId: alert.id, emailSent, whatsappSent, count: toNotify.length });
    } else {
      alertsApiLogger.warn("MissedNotif → no se pudo enviar por ningún canal", { alertId: alert.id, toNotifyCount: toNotify.length });
    }
  }

  return { alerts_processed: alerts.length, notifications_created: notificationsCreated };
}
