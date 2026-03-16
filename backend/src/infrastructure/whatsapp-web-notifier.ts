// whatsapp-web.js no está publicado como módulo ESM puro, así que importamos el paquete completo
// y extraemos Client / LocalAuth desde ahí.
import whatsAppPkg from "whatsapp-web.js";
const { Client, LocalAuth } = whatsAppPkg as any;
import qrcode from "qrcode-terminal";
import { appLogger } from "../lib/logger.js";

let client: any = null;
let initializing = false;
let ready = false;

function initClient(): Promise<void> {
  appLogger.info("initClient WhatsApp Web llamado", { ready, initializing });
  if (ready) return Promise.resolve();
  if (initializing) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (ready) {
          clearInterval(interval);
          resolve();
        }
      }, 500);
    });
  }
  initializing = true;

  client = new Client({
    authStrategy: new LocalAuth({ clientId: "escuela-backend" }),
    puppeteer: {
      headless: false,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  });

  client.on("qr", (qr: any) => {
    appLogger.info("WhatsApp QR generado. Escanealo con tu teléfono para iniciar sesión.");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    ready = true;
    initializing = false;
    appLogger.info("WhatsApp Web listo (whatsapp-web.js).");
  });

  client.on("auth_failure", (msg: any) => {
    appLogger.error("Fallo de autenticación en WhatsApp Web", { msg });
  });

  client.on("disconnected", (reason: any) => {
    ready = false;
    appLogger.warn("WhatsApp Web desconectado, se intentará reconectar al próximo envío", { reason });
  });

  client.initialize().catch((err: any) => {
    initializing = false;
    appLogger.error("Error inicializando WhatsApp Web", { error: String(err) });
  });

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (ready) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
  });
}

function normalizeNumber(raw: string): string {
  const cleaned = raw.replace(/\D/g, "");
  if (!cleaned) return cleaned;
  let n = cleaned;
  if (n.startsWith("00")) n = n.slice(2);
  // Quitar ceros iniciales típicos de prefijo local
  n = n.replace(/^0+/, "");
  if (!n.startsWith("54")) {
    n = "54" + n;
  }
  return n;
}

export async function sendWhatsappMessage(toRaw: string, text: string): Promise<boolean> {
  try {
    await initClient();
    if (!client || !ready) {
      appLogger.error("WhatsApp Web no está listo para enviar mensajes");
      return false;
    }
    const normalized = normalizeNumber(toRaw);
    const jid = normalized + "@c.us";
    appLogger.info("Enviando WhatsApp", { to: jid, text: text.slice(0, 100) });
    await client.sendMessage(jid, text);
    appLogger.info("WhatsApp enviado OK", { to: jid });
    return true;
  } catch (e) {
    appLogger.error("Error enviando WhatsApp", { error: (e as Error).message });
    return false;
  }
}

