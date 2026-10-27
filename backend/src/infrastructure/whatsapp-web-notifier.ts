import { alertsApiLogger } from "../lib/logger.js";
import { config } from "../config.js";

const WA_SERVICE_URL = process.env.WA_SERVICE_URL ?? "http://localhost:3099";
const META_TOKEN     = process.env.WHATSAPP_BUSINESS_TOKEN;
const META_PHONE_ID  = process.env.WHATSAPP_PHONE_NUMBER_ID;

function normalizeNumber(raw: string): string {
  const cleaned = raw.replace(/\D/g, "");
  if (!cleaned) return cleaned;
  let n = cleaned;
  if (n.startsWith("00")) n = n.slice(2);
  n = n.replace(/^0+/, "");
  if (n.startsWith("549")) return n;
  if (n.startsWith("54") && !n.startsWith("549")) return "549" + n.slice(2);
  return "549" + n;
}

/** Envía usando la Meta Cloud API (WhatsApp Business).
 *  Requiere WHATSAPP_BUSINESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID en el .env */
async function sendViaMetaApi(to: string, text: string): Promise<boolean> {
  const url = `https://graph.facebook.com/v19.0/${META_PHONE_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${META_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;
  if (res.ok && data?.messages?.[0]?.id) {
    alertsApiLogger.info("WhatsApp Meta API enviado OK", { to, msgId: data.messages[0].id });
    return true;
  }
  alertsApiLogger.warn("WhatsApp Meta API no enviado", { to, status: res.status, data });
  return false;
}

/** Envía usando el servicio local whatsapp-web.js (número personal). */
async function sendViaLocalService(to: string, text: string): Promise<boolean> {
  const res = await fetch(`${WA_SERVICE_URL}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, message: text }),
  });
  const data = (await res.json()) as { sent: boolean };
  if (data.sent) {
    alertsApiLogger.info("WhatsApp local enviado OK", { to });
    return true;
  }
  alertsApiLogger.warn("WhatsApp local no enviado", { to });
  return false;
}

export async function sendWhatsappMessage(toRaw: string, text: string): Promise<boolean> {
  const to = normalizeNumber(toRaw);
  const useMeta = config.WHATSAPP_PROVIDER === "meta";
  if (useMeta && !(META_TOKEN && META_PHONE_ID)) {
    alertsApiLogger.error("WHATSAPP_PROVIDER=meta pero faltan WHATSAPP_BUSINESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID en .env");
    return false;
  }
  try {
    return useMeta ? await sendViaMetaApi(to, text) : await sendViaLocalService(to, text);
  } catch (e) {
    alertsApiLogger.error("Error enviando WhatsApp", {
      canal: useMeta ? "meta_api" : "local",
      error: (e as Error).message,
    });
    return false;
  }
}
