// Delega al servicio compartido de WhatsApp (puerto 3099)
import { alertsApiLogger } from "../lib/logger.js";

const WA_SERVICE_URL = process.env.WA_SERVICE_URL ?? "http://localhost:3099";

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

export async function sendWhatsappMessage(toRaw: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${WA_SERVICE_URL}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: normalizeNumber(toRaw), message: text }),
    });
    const data = (await res.json()) as { sent: boolean };
    if (data.sent) {
      alertsApiLogger.info("WhatsApp enviado OK", { to: toRaw });
      return true;
    }
    alertsApiLogger.warn("WhatsApp no enviado", { to: toRaw });
    return false;
  } catch (e) {
    alertsApiLogger.error("Error llamando al servicio de WhatsApp", { error: (e as Error).message });
    return false;
  }
}
