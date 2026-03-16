import type { FastifyPluginAsync } from "fastify";
import { contestSearchService } from "../services/contest-search.service.js";
import { emailNotifier } from "../infrastructure/email-notifier.js";
import { isEmailConfigured } from "../config.js";
import { schedulerService } from "../services/scheduler.service.js";

const requestSchema = {
  body: {
    type: "object",
    required: ["alert_id"],
    properties: {
      alert_id: { type: "number" },
      date_from: { type: "string" },
      date_to: { type: "string" },
      departments: { type: "array", items: { type: "string" } },
      subject_ids: { type: "array", items: { type: "number" } },
      limit: { type: "number" },
    },
  },
};

export const alertMetaRoutes: FastifyPluginAsync = async (app) => {
  app.get("/notification-info", async () => {
    const status = schedulerService.getStatus();
    return {
      when_sent: "Las notificaciones se envían cuando se ejecuta un scraping de concursos.",
      scheduler_running: status.is_running,
      scheduler_next_run: status.next_run,
      scheduler_last_run: status.last_run,
      how_to_trigger: "Ejecutá un scraping desde 'Estado de scraping' para procesar concursos y enviar notificaciones.",
      email_configured: isEmailConfigured(),
      whatsapp_configured: false,
      message: isEmailConfigured()
        ? "Email configurado (Brevo/SendGrid). Revisar .env si falla el envío."
        : "Configurar SENDER_EMAIL y BREVO_API_KEY o SENDGRID_API_KEY en .env",
    };
  });

  app.post<{
    Body: {
      alert_id: number;
      date_from?: string;
      date_to?: string;
      departments?: string[];
      subject_ids?: number[];
      limit?: number;
    };
  }>("/test-contest-notifications", { schema: requestSchema }, async (req, reply) => {
    const { alert_id, date_from, date_to, departments, subject_ids, limit = 10 } = req.body;
    const db = req.server.prisma;

    const alert = await db.alert.findUnique({ where: { id: alert_id } });
    if (!alert) return reply.status(404).send({ error: "Alert not found" });

    const email = (alert.email_address ?? "").trim();
    if (!email) return reply.status(400).send({ error: "La alerta no tiene email" });

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
      sent = await emailNotifier.send({
        to: email,
        subject,
        html,
      });
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
        : "No se pudo enviar el email. Revisar backend/.env y backend/logs/email.log para ver el error (Brevo/SendGrid).";

    return {
      success: sent,
      message,
      contests_sent: contests.length,
      email_subject: subject,
      filters_summary: filtersSummary,
      whatsapp_number: (alert.whatsapp_number ?? "").trim() || null,
    };
  });
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
