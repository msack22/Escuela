import { config, isEmailConfigured } from "../config.js";
import { emailLogger } from "../lib/logger.js";

async function sendViaBrevo(to: string, subject: string, html: string): Promise<boolean> {
  if (!config.BREVO_API_KEY) {
    emailLogger.error("Brevo: BREVO_API_KEY vacío");
    return false;
  }
  emailLogger.info("Enviando por Brevo", { to, subject: subject.slice(0, 50) });
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": config.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Sistema de Concursos", email: config.SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    const body = await res.text();
    if (res.ok) {
      emailLogger.info("Brevo OK", { to });
      return true;
    }
    emailLogger.error("Brevo falló", { status: res.status, body: body.slice(0, 500) });
    return false;
  } catch (e) {
    emailLogger.error("Brevo excepción", { error: (e as Error).message });
    return false;
  }
}

async function sendViaSendGrid(to: string, subject: string, html: string): Promise<boolean> {
  if (!config.SENDGRID_API_KEY) {
    emailLogger.error("SendGrid: SENDGRID_API_KEY vacío");
    return false;
  }
  emailLogger.info("Enviando por SendGrid", { to, subject: subject.slice(0, 50) });
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], subject }],
        from: { email: config.SENDER_EMAIL, name: "Sistema de Concursos" },
        content: [{ type: "text/html", value: html }],
      }),
    });
    const body = await res.text();
    if (res.status === 200 || res.status === 202 || res.ok) {
      emailLogger.info("SendGrid OK", { to });
      return true;
    }
    emailLogger.error("SendGrid falló", { status: res.status, body: body.slice(0, 500) });
    return false;
  } catch (e) {
    emailLogger.error("SendGrid excepción", { error: (e as Error).message });
    return false;
  }
}

export const emailNotifier = {
  isConfigured: isEmailConfigured,

  async send(params: { to: string; subject: string; html: string }): Promise<boolean> {
    emailLogger.info("send_email iniciado", { to: params.to, hasSubject: !!params.subject });
    if (!config.SENDER_EMAIL) {
      emailLogger.error("SENDER_EMAIL no configurado en .env");
      return false;
    }
    if (config.BREVO_API_KEY) {
      const ok = await sendViaBrevo(params.to, params.subject, params.html);
      if (ok) return true;
    }
    if (config.SENDGRID_API_KEY) {
      const ok = await sendViaSendGrid(params.to, params.subject, params.html);
      if (ok) return true;
    }
    if (!config.BREVO_API_KEY && !config.SENDGRID_API_KEY) {
      emailLogger.error("Ninguna API configurada: falta BREVO_API_KEY o SENDGRID_API_KEY en .env");
    }
    return false;
  },
};
