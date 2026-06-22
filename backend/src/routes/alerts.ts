import type { FastifyPluginAsync } from "fastify";
import { isEmailConfigured } from "../config.js";

export const alertsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/notification-channels", async () => {
    return {
      available: isEmailConfigured() ? ["email", "whatsapp", "both"] : ["email", "both"],
      all: ["whatsapp", "email", "both"],
      status: { whatsapp: false, email: isEmailConfigured(), both: isEmailConfigured() },
    };
  });

  app.get("/", async (req, reply) => {
    const list = await req.server.prisma.alert.findMany({
      where: { is_active: true },
      orderBy: { id: "desc" },
    });
    return list;
  });

  app.post<{
    Body: {
      user_id?: number;
      user_name?: string;
      email_address?: string;
      whatsapp_number?: string;
      subject_preferences?: string | string[];
      excluded_subjects?: string[];
      departments?: string[];
      max_distance_km?: number;
      notification_channels?: string;
    };
  }>("/", async (req, reply) => {
    const body = req.body;
    let userName = body.user_name ?? "Sin nombre";
    let emailAddress = body.email_address ?? null;
    let whatsappNumber = (body.whatsapp_number ?? "").trim();

    if (body.user_id) {
      const user = await req.server.prisma.user.findUnique({ where: { id: body.user_id } });
      if (user) {
        userName = userName === "Sin nombre" ? user.name : userName;
        emailAddress = emailAddress ?? user.email;
        if (!whatsappNumber && user.phone_number) {
          whatsappNumber = user.phone_number.trim();
        }
      }
    }
    if (!emailAddress && !whatsappNumber && !body.user_id) {
      return reply.status(400).send({ error: "Se requiere al menos email o número de WhatsApp" });
    }

    const prefs = body.subject_preferences;
    const departments = Array.isArray(body.departments) ? body.departments : [];
    const excluded_subjects = Array.isArray(body.excluded_subjects) ? body.excluded_subjects : [];
    const subjectPreferences =
      typeof prefs === "string"
        ? prefs
        : Array.isArray(prefs)
          ? JSON.stringify({ subjects: prefs, departments, excluded_subjects })
          : JSON.stringify({ subjects: [], departments, excluded_subjects });
    const alert = await req.server.prisma.alert.create({
      data: {
        user_id: body.user_id ?? null,
        user_name: userName,
        email_address: emailAddress,
        whatsapp_number: whatsappNumber,
        subject_preferences: subjectPreferences,
        max_distance_km: body.max_distance_km ?? 50,
        notification_channels: body.notification_channels ?? "both",
      },
    });
    return alert;
  });

  app.post<{ Body: { email_address?: string; whatsapp_number?: string; channels?: string[] } }>("/test-notification", { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { email_address, whatsapp_number, channels } = req.body ?? {};
    if (!email_address && !whatsapp_number) return reply.status(400).send({ detail: "email_address or whatsapp_number required" });
    const sent: string[] = [];
    if (email_address && isEmailConfigured()) {
      const { emailNotifier } = await import("../infrastructure/email-notifier.js");
      const ok = await emailNotifier.send({ to: email_address, subject: "Prueba de notificación", html: "<p>Email de prueba desde el sistema de concursos.</p>" });
      if (ok) sent.push("email");
    }
    if (whatsapp_number) {
      const { sendWhatsappMessage } = await import("../infrastructure/whatsapp-web-notifier.js");
      const ok = await sendWhatsappMessage(whatsapp_number, "Mensaje de prueba desde el sistema de concursos 🔔");
      if (ok) sent.push("whatsapp");
    }
    return { message: "Test notification sent", channels_sent: sent };
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ error: "Invalid id" });
    const alert = await req.server.prisma.alert.findUnique({ where: { id } });
    if (!alert) return reply.status(404).send({ error: "Not found" });
    return alert;
  });

  app.put<{
    Params: { id: string };
    Body: {
      user_id?: number | null;
      user_name?: string | null;
      email_address?: string | null;
      whatsapp_number?: string | null;
      subject_preferences?: string | string[] | null;
      excluded_subjects?: string[] | null;
      departments?: string[] | null;
      max_distance_km?: number | null;
      notification_channels?: string | null;
      is_active?: boolean | null;
    };
  }>("/:id", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ error: "Invalid id" });

    const body = req.body ?? {};

    const prefs = body.subject_preferences;
    const departments = Array.isArray(body.departments) ? body.departments : undefined;
    const excluded_subjects = Array.isArray(body.excluded_subjects) ? body.excluded_subjects : undefined;
    const subjectPreferences =
      prefs == null && departments == null && excluded_subjects == null
        ? undefined
        : (() => {
            if (typeof prefs === "string") return prefs;
            if (Array.isArray(prefs) || Array.isArray(departments) || Array.isArray(excluded_subjects)) {
              return JSON.stringify({
                subjects: Array.isArray(prefs) ? prefs : [],
                departments: Array.isArray(departments) ? departments : [],
                excluded_subjects: Array.isArray(excluded_subjects) ? excluded_subjects : [],
              });
            }
            return undefined;
          })();

    const data: Parameters<typeof req.server.prisma.alert.update>[0]["data"] = {};

    if ("user_id" in body) data.user_id = body.user_id ?? null;
    if ("user_name" in body && body.user_name != null) data.user_name = body.user_name;
    // Email y WhatsApp se derivan del usuario; ignoramos actualizaciones directas desde el cliente.
    if (subjectPreferences !== undefined) data.subject_preferences = subjectPreferences;
    if ("max_distance_km" in body && body.max_distance_km != null)
      data.max_distance_km = body.max_distance_km;
    if ("notification_channels" in body && body.notification_channels != null)
      data.notification_channels = body.notification_channels;
    if ("is_active" in body && body.is_active != null) data.is_active = body.is_active;

    const alert = await req.server.prisma.alert.update({
      where: { id },
      data,
    });
    return alert;
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ error: "Invalid id" });
    await req.server.prisma.alert.update({
      where: { id },
      data: { is_active: false },
    });
    return { success: true };
  });

  app.post<{
    Params: { id: string };
    Body: { date_from?: string; date_to?: string; departments?: string[]; subject_ids?: number[]; limit?: number };
  }>("/:id/test-contest-notifications", async (req, reply) => {
    const alertId = parseInt(req.params.id, 10);
    if (Number.isNaN(alertId)) return reply.status(400).send({ error: "Invalid id" });
    const { handleTestContestNotifications } = await import("../services/alert-test.service.js");
    const result = await handleTestContestNotifications(req.server.prisma, alertId, req.body);
    if ("statusCode" in result && result.statusCode) {
      return reply.status(result.statusCode).send({ detail: result.error });
    }
    return result;
  });

  // Historial de notificaciones enviadas para una alerta
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>("/:id/history", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ error: "Invalid id" });
    const limit = Math.min(parseInt(req.query.limit ?? "100", 10) || 100, 200);

    const rows = await req.server.prisma.contestNotificationSent.findMany({
      where: { alert_id: id },
      orderBy: { sent_at: "desc" },
      take: limit,
      include: {
        contest: {
          select: {
            id: true,
            title: true,
            date: true,
            level: true,
            shift: true,
            source_url: true,
            school: { select: { name: true, city: true, department: true } },
            subject: { select: { name: true } },
            items: { include: { subject: { select: { name: true } } } },
          },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      contest_id: r.contest_id,
      sent_at: r.sent_at,
      status: r.status,
      error_message: r.error_message,
      contest: r.contest,
    }));
  });

  app.post<{ Body: { recipient_whatsapp?: string; recipient_email?: string; message?: string; channels?: string[] } }>("/send-multi", async () => {
    return { message: "send-multi not implemented (WhatsApp requires external service)", sent: false };
  });
};
