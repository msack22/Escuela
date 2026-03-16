import type { PrismaClient } from "@prisma/client";
import { contestSearchService } from "./contest-search.service.js";
import { emailNotifier } from "../infrastructure/email-notifier.js";
import { isEmailConfigured } from "../config.js";

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

export async function handleTestContestNotifications(
  db: PrismaClient,
  alertId: number,
  body: TestContestNotificationsBody
) {
  const { date_from, date_to, departments, subject_ids, limit = 10 } = body;
  const alert = await db.alert.findUnique({ where: { id: alertId } });
  if (!alert) return { error: "Alert not found", statusCode: 404 };
  const email = (alert.email_address ?? "").trim();
  if (!email) return { error: "La alerta no tiene email", statusCode: 400 };

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
        `<p><strong>${escapeHtml(c.title)}</strong><br/>${(c.school?.city ?? "")} – ${(c.school?.department ?? "")} | ${(c.subject?.name ?? "")}<br/><a href="${escapeHtml(c.source?.url ?? "")}">Ver</a></p>`
    )
    .join("");

  let sent = false;
  if (isEmailConfigured()) {
    sent = await emailNotifier.send({ to: email, subject, html });
  }

  const filtersSummary = [
    date_from && `Desde: ${date_from}`,
    date_to && `Hasta: ${date_to}`,
    departments?.length && `Departamentos: ${departments.join(", ")}`,
    subject_ids?.length && `Materias: ${subject_ids.length}`,
  ]
    .filter(Boolean)
    .join("; ");

  const message = sent
    ? `Email de prueba enviado a ${email} con ${contests.length} concurso(s).`
    : !isEmailConfigured()
      ? "Email no configurado. Revisar .env (SENDER_EMAIL, BREVO_API_KEY o SENDGRID_API_KEY)."
      : "No se pudo enviar el email. Revisar .env y logs.";

  return {
    success: sent,
    message,
    contests_sent: contests.length,
    email_subject: subject,
    filters_summary: filtersSummary,
    whatsapp_number: (alert.whatsapp_number ?? "").trim() || null,
  };
}
