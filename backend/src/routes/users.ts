import type { FastifyPluginAsync } from "fastify";

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { skip?: string; limit?: string } }>("/", async (req) => {
    const skip = Math.max(0, parseInt(req.query.skip ?? "0", 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? "100", 10) || 100));
    const users = await req.server.prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { id: "asc" },
    });
    const withAlertCount = await Promise.all(
      users.map(async (u) => {
        const alert_count = await req.server.prisma.alert.count({ where: { user_id: u.id } });
        return {
          id: u.id,
          username: u.name,
          email: u.email,
          phone_number: u.phone_number ?? "",
          is_active: u.is_active,
          created_at: u.created_at?.toISOString() ?? null,
          alert_count,
        };
      })
    );
    return withAlertCount;
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid id" });
    const user = await req.server.prisma.user.findUnique({ where: { id } });
    if (!user) return reply.status(404).send({ detail: "User not found" });
    return {
      id: user.id,
      username: user.name,
      email: user.email,
      phone_number: user.phone_number ?? "",
      is_active: user.is_active,
      created_at: user.created_at?.toISOString() ?? null,
    };
  });

  app.post<{ Body: { username?: string; email?: string; phone_number?: string; is_active?: boolean } }>("/", async (req, reply) => {
    const body = req.body;
    if (!body.email?.trim()) return reply.status(400).send({ detail: "email required" });
    const user = await req.server.prisma.user.create({
      data: {
        name: body.username ?? body.email,
        email: body.email.trim(),
        phone_number: body.phone_number?.replace(/\s/g, "") || null,
        is_active: body.is_active ?? true,
      },
    });
    return { id: user.id, username: user.name, email: user.email, phone_number: user.phone_number, is_active: user.is_active, created_at: user.created_at };
  });

  app.put<{ Params: { id: string }; Body: { username?: string; email?: string; phone_number?: string; is_active?: boolean } }>("/:id", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid id" });
    const body = req.body;
    const user = await req.server.prisma.user.update({
      where: { id },
      data: {
        ...(body.username != null && { name: body.username }),
        ...(body.email != null && { email: body.email }),
        ...(body.phone_number != null && { phone_number: body.phone_number.replace(/\s/g, "") || null }),
        ...(body.is_active != null && { is_active: body.is_active }),
      },
    });
    return user;
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid id" });
    await req.server.prisma.user.delete({ where: { id } });
    return { message: "User deleted" };
  });

  app.get<{ Params: { id: string } }>("/:id/alerts", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid id" });
    const alerts = await req.server.prisma.alert.findMany({ where: { user_id: id }, orderBy: { id: "desc" } });
    return alerts.map((a) => ({
      id: a.id,
      user_name: a.user_name,
      whatsapp_number: a.whatsapp_number,
      subject_preferences: a.subject_preferences,
      max_distance_km: a.max_distance_km,
      created_at: a.created_at,
      is_active: a.is_active,
    }));
  });

  app.get<{ Params: { id: string } }>("/:id/contest-notifications", async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.status(400).send({ detail: "Invalid id" });
    const notifications = await req.server.prisma.contestNotificationSent.findMany({
      where: { alert: { user_id: id } },
      include: { contest: { include: { school: true, subject: true } } },
      orderBy: { sent_at: "desc" },
      take: 100,
    });
    return notifications.map((n) => ({
      id: n.id,
      user_id: id,
      contest_id: n.contest_id,
      contest_title: n.contest.title,
      school_name: n.contest.school?.name,
      subject_name: n.contest.subject?.name,
      sent_at: n.sent_at,
      contest_date: n.contest.date?.toISOString?.(),
    }));
  });
};
