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
    const prefs = body.subject_preferences;
    const subjectPreferences =
      typeof prefs === "string" ? prefs : Array.isArray(prefs) ? JSON.stringify(prefs) : "[]";
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

  app.post<{ Body: { email_address?: string; whatsapp_number?: string; channels?: string[] } }>("/test-notification", async (req, reply) => {
    const { email_address, whatsapp_number, channels } = req.body ?? {};
    if (!email_address && !whatsapp_number) return reply.status(400).send({ detail: "email_address or whatsapp_number required" });
    const sent: string[] = [];
    if (email_address && isEmailConfigured()) {
      const { emailNotifier } = await import("../infrastructure/email-notifier.js");
      const ok = await emailNotifier.send({ to: email_address, subject: "Prueba de notificación", html: "<p>Email de prueba desde el sistema de concursos.</p>" });
      if (ok) sent.push("email");
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

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>("/:id", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ error: "Invalid id" });
    const alert = await req.server.prisma.alert.update({
      where: { id },
      data: req.body as Parameters<typeof req.server.prisma.alert.update>[0]["data"],
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

  app.post<{ Body: { recipient_whatsapp?: string; recipient_email?: string; message?: string; channels?: string[] } }>("/send-multi", async () => {
    return { message: "send-multi not implemented (WhatsApp requires external service)", sent: false };
  });
};
