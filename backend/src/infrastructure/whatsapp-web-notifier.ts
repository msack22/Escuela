// whatsapp-web.js no está publicado como módulo ESM puro, así que importamos el paquete completo
// y extraemos Client / LocalAuth desde ahí.
import whatsAppPkg from "whatsapp-web.js";
const { Client, LocalAuth } = whatsAppPkg as any;
import qrcode from "qrcode-terminal";
import { alertsApiLogger } from "../lib/logger.js";

let client: any = null;
let initializing = false;
let ready = false;

const DEFAULT_INIT_TIMEOUT_MS = 60_000;

async function initClient(timeoutMs: number = DEFAULT_INIT_TIMEOUT_MS): Promise<void> {
  alertsApiLogger.info("initClient WhatsApp Web llamado", { ready, initializing });
  if (ready) return Promise.resolve();
  if (initializing) {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (ready) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve();
        }
      }, 500);
      const timer = setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`WhatsApp Web no llegó a 'ready' en ${timeoutMs}ms (sigue inicializando)`));
      }, timeoutMs);
    });
  }
  initializing = true;

  if (client) {
    try { await client.destroy(); } catch {}
    client = null;
  }

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: "escuela-backend",
      dataPath: "/Users/matiassack/Documents/Matias/whatsapp-session",
    }),
    puppeteer: {
      headless: true,
      // Aumenta tiempos internos de CDP para reducir `Runtime.callFunctionOn timed out`.
      protocolTimeout: 120_000,
      // Evita algunos modales/avisos del navegador y reduce flakiness.
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-notifications",
        "--disable-infobars",
        "--no-default-browser-check",
        "--disable-features=TranslateUI",
      ],
    },
  });

  client.on("qr", (qr: any) => {
    alertsApiLogger.info("WhatsApp QR generado. Escanealo con tu teléfono para iniciar sesión.");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    ready = true;
    initializing = false;
    alertsApiLogger.info("WhatsApp Web listo (whatsapp-web.js).");
  });

  client.on("auth_failure", (msg: any) => {
    ready = false;
    initializing = false;
    alertsApiLogger.error("Fallo de autenticación en WhatsApp Web", { msg });
  });

  client.on("disconnected", (reason: any) => {
    ready = false;
    initializing = false;
    alertsApiLogger.warn("WhatsApp Web desconectado, se intentará reconectar al próximo envío", { reason });
  });

  client.initialize().catch((err: any) => {
    initializing = false;
    alertsApiLogger.error("Error inicializando WhatsApp Web", { error: String(err) });
  });

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (ready) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve();
      }
    }, 500);
    const timer = setTimeout(() => {
      clearInterval(interval);
      // No marcamos ready=false porque ya lo está; dejamos initializing=false para permitir reintento.
      initializing = false;
      reject(
        new Error(
          `WhatsApp Web no llegó a 'ready' en ${timeoutMs}ms. Si es la primera vez, necesitás escanear el QR del proceso; si ya estaba logueado, puede haberse vencido la sesión.`,
        ),
      );
    }, timeoutMs);
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
      alertsApiLogger.error("WhatsApp Web no está listo para enviar mensajes");
      return false;
    }
    const normalized = normalizeNumber(toRaw);
    const jid = normalized + "@c.us";
    alertsApiLogger.info("Enviando WhatsApp", { to: jid, text: text.slice(0, 100) });
    await client.sendMessage(jid, text);
    alertsApiLogger.info("WhatsApp enviado OK", { to: jid });
    return true;
  } catch (e) {
    const msg = (e as Error).message || "";
    alertsApiLogger.error("Error enviando WhatsApp", { error: msg });

    // Si el frame de WhatsApp quedó roto, reiniciar cliente y reintentar una sola vez
    if (msg.includes("detached Frame")) {
      alertsApiLogger.warn("Frame de WhatsApp roto, reintentando con nuevo navegador");
      try {
        ready = false;
        initializing = false;
        if (client) {
          try { await client.destroy(); } catch {}
        }
        client = null;
        await initClient();
        if (!client || !ready) {
          alertsApiLogger.error("WhatsApp Web no está listo después del reintento");
          return false;
        }
        const normalized = normalizeNumber(toRaw);
        const jid = normalized + "@c.us";
        alertsApiLogger.info("Enviando WhatsApp (reintento)", { to: jid, text: text.slice(0, 100) });
        await client.sendMessage(jid, text);
        alertsApiLogger.info("WhatsApp enviado OK tras reintento", { to: jid });
        return true;
      } catch (e2) {
        alertsApiLogger.error("Error enviando WhatsApp tras reintento", {
          error: (e2 as Error).message,
        });
        return false;
      }
    }

    return false;
  }
}

