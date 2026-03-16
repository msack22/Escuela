import type { FastifyPluginAsync } from "fastify";
import { isEmailConfigured } from "../config.js";
import { schedulerService } from "../services/scheduler.service.js";
import { handleTestContestNotifications } from "../services/alert-test.service.js";

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
    const { alert_id, date_from, date_to, departments, subject_ids, limit } = req.body;
    const db = req.server.prisma;

    const result = await handleTestContestNotifications(db, alert_id, {
      date_from,
      date_to,
      departments,
      subject_ids,
      limit,
    });

    if ("statusCode" in result && result.statusCode) {
      return reply.status(result.statusCode).send({ detail: result.error });
    }
    return result;
  });
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
