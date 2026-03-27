import type { PrismaClient } from "@prisma/client";
import { contestSearchService } from "./contest-search.service.js";
import { emailNotifier } from "../infrastructure/email-notifier.js";
import { isEmailConfigured } from "../config.js";
import { sendWhatsappMessage } from "../infrastructure/whatsapp-web-notifier.js";
import { alertsApiLogger } from "../lib/logger.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface TestContestNotificationsBody {
  date_from?: string;
  date_to?: string;
  departments?: string[];
  subject_ids?: number[];
  limit?: number;
}

export interface AutoNotificationContext {
  contests: { id: number }[];
}

export async function handleTestContestNotifications(
  db: PrismaClient,
  alertId: number,
  body: TestContestNotificationsBody
) {
  const formatDateTime = (d: string | null | undefined) =>
    d
      ? new Date(d).toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const { date_from, date_to, departments, subject_ids, limit = 10 } = body;
  const alert = await db.alert.findUnique({ where: { id: alertId } });
  if (!alert) return { error: "Alert not found", statusCode: 404 };
  const user = alert.user_id ? await db.user.findUnique({ where: { id: alert.user_id } }) : null;
  const email = ((alert.email_address || user?.email) ?? "").trim();
  const whatsapp = ((alert.whatsapp_number || user?.phone_number) ?? "").trim();
  if (!email && !whatsapp) {
    return { error: "La alerta no tiene email ni WhatsApp (ni usuario asociado)", statusCode: 400 };
  }

  alertsApiLogger.info("TestContestNotifications datos", {
    alertId,
    userId: alert.user_id,
    email_from_alert: alert.email_address,
    email_from_user: user?.email,
    whatsapp_from_alert: alert.whatsapp_number,
    whatsapp_from_user: user?.phone_number,
    email,
    whatsapp,
  });

  const result = await contestSearchService.search({
    skip: 0,
    limit,
    dateFrom: date_from ? new Date(date_from) : undefined,
    dateTo: date_to ? new Date(date_to) : undefined,
    departments,
    subjectIds: subject_ids,
  });

  const contests = result.contests;
  if (contests.length === 0) {
    return {
      success: true,
      message: "No hay concursos que coincidan con los filtros. No se envió email.",
      contests_sent: 0,
    };
  }

  const subject = `Prueba de notificaciones – ${contests.length} concurso(s) según tus filtros`;
  const html = contests
    .map(
      (c) =>
        `<p><strong>${escapeHtml(c.title)}</strong><br/>` +
        `Fecha concurso: ${escapeHtml(formatDateTime(c.date))}<br/>` +
        `Horas: ${c.hours_to_cover ?? "—"}<br/>` +
        `Materia/Cargo: ${escapeHtml(c.subject?.name ?? "—")}<br/>` +
        `${escapeHtml(c.school?.city ?? "")} – ${escapeHtml(c.school?.department ?? "")}<br/>` +
        `<a href="${escapeHtml(c.source?.url ?? "")}">Ver</a></p>`
    )
    .join("");

  const filtersSummary = [
    date_from && `Desde: ${date_from}`,
    date_to && `Hasta: ${date_to}`,
    departments?.length && `Departamentos: ${departments.join(", ")}`,
    subject_ids?.length && `Materias: ${subject_ids.length}`,
  ]
    .filter(Boolean)
    .join("; ");

  // Aviso previo por WhatsApp (si hay número configurado)
  let whatsappSent = false;
  if (whatsapp) {
    const destination = email ? `un correo de prueba a ${email}` : "un mensaje de prueba por este canal";
    const lines = contests.map(
      (c) =>
        `• ${c.title}\n` +
        `  Fecha concurso: ${formatDateTime(c.date)}\n` +
        `  Horas: ${c.hours_to_cover ?? "—"}\n` +
        `  Materia/Cargo: ${c.subject?.name ?? "—"}\n` +
        `  ${c.source?.url ?? "—"}`
    );
    const preview =
      `Te vamos a enviar ${destination} con ${contests.length} concurso(s).\n` +
      `Asunto: ${subject}.\n` +
      `Filtros: ${filtersSummary || "sin filtros"}. (número alerta: ${whatsapp})\n\n` +
      `${lines.join("\n\n")}`;
    whatsappSent = await sendWhatsappMessage(whatsapp, preview);
  }

  let emailSent = false;
  if (email) {
    if (isEmailConfigured()) {
      emailSent = await emailNotifier.send({ to: email, subject, html });
    } else {
      emailSent = false;
    }
  }

  const sentAny = emailSent || whatsappSent;

  if (sentAny) {
    // Importante: en pruebas, también marcamos como notificado para evitar re-notificar
    // los mismos concursos en ejecuciones automáticas posteriores.
    await db.contestNotificationSent.createMany({
      data: contests.map((c) => ({ alert_id: alertId, contest_id: c.id })),
      skipDuplicates: true,
    });
  }

  const message = sentAny
    ? `Prueba enviada${emailSent ? ` por email a ${email}` : ""}${whatsappSent ? `${emailSent ? " y" : ""} por WhatsApp a ${whatsapp}` : ""} con ${contests.length} concurso(s).`
    : email && !isEmailConfigured()
      ? "Email no configurado. Revisar backend/.env (SENDER_EMAIL, BREVO_API_KEY o SENDGRID_API_KEY) y backend/logs/email.log."
      : "No se pudo enviar la prueba. Revisar backend/logs/app.log y backend/logs/email.log para ver el error (Brevo/SendGrid/WhatsApp).";

  return {
    success: sentAny,
    message,
    contests_sent: contests.length,
    email_subject: subject,
    filters_summary: filtersSummary,
    whatsapp_number: (alert.whatsapp_number ?? "").trim() || null,
  };
}
