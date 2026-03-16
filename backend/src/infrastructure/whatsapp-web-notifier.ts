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
  // Quitar todo lo que no sea dígito (espacios, guiones, paréntesis, etc.)
  const cleaned = raw.replace(/\D/g, "");
  if (!cleaned) return cleaned;

  let n = cleaned;

  // Quitar prefijo internacional 00
  if (n.startsWith("00")) n = n.slice(2);

  // Quitar ceros locales al inicio (0, 011, etc.)
  n = n.replace(/^0+/, "");

  // Si ya viene con 549 (Argentina + móvil), lo dejamos
  if (n.startsWith("549")) {
    return n;
  }

  // Si viene con 54 y luego el código de área sin 9 (ej: 54 344...), insertamos el 9
  if (n.startsWith("54") && !n.startsWith("549")) {
    const rest = n.slice(2); // después de 54
    return "549" + rest;
  }

  // Si no tiene 54, asumimos número argentino y agregamos 549 al inicio
  if (!n.startsWith("54")) {
    return "549" + n;
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
    const msg = (e as Error).message || "";
    appLogger.error("Error enviando WhatsApp", { error: msg });

    // Si el frame de WhatsApp quedó roto, reiniciar cliente y reintentar una sola vez
    if (msg.includes("detached Frame")) {
      appLogger.warn("Frame de WhatsApp roto, reintentando con nuevo navegador");
      try {
        ready = false;
        initializing = false;
        client = null;
        await initClient();
        if (!client || !ready) {
          appLogger.error("WhatsApp Web no está listo después del reintento");
          return false;
        }
        const normalized = normalizeNumber(toRaw);
        const jid = normalized + "@c.us";
        appLogger.info("Enviando WhatsApp (reintento)", { to: jid, text: text.slice(0, 100) });
        await client.sendMessage(jid, text);
        appLogger.info("WhatsApp enviado OK tras reintento", { to: jid });
        return true;
      } catch (e2) {
        appLogger.error("Error enviando WhatsApp tras reintento", {
          error: (e2 as Error).message,
        });
        return false;
      }
    }

    return false;
  }
}

