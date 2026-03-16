import { config, isEmailConfigured } from "../config.js";

async function sendViaBrevo(to: string, subject: string, html: string): Promise<boolean> {
  if (!config.BREVO_API_KEY) return false;
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
  return res.ok;
}

async function sendViaSendGrid(to: string, subject: string, html: string): Promise<boolean> {
  if (!config.SENDGRID_API_KEY) return false;
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
  return res.status === 200 || res.status === 202 || res.ok;
}

export const emailNotifier = {
  isConfigured: isEmailConfigured,

  async send(params: { to: string; subject: string; html: string }): Promise<boolean> {
    if (!config.SENDER_EMAIL) return false;
    if (config.BREVO_API_KEY) {
      const ok = await sendViaBrevo(params.to, params.subject, params.html);
      if (ok) return true;
    }
    if (config.SENDGRID_API_KEY) {
      const ok = await sendViaSendGrid(params.to, params.subject, params.html);
      if (ok) return true;
    }
    return false;
  },
};
