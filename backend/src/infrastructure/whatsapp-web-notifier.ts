// whatsapp-web.js no está publicado como módulo ESM puro, así que importamos el paquete completo
// y extraemos Client / LocalAuth desde ahí.
import whatsAppPkg from "whatsapp-web.js";
const { Client, LocalAuth } = whatsAppPkg as any;
import qrcode from "qrcode-terminal";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { alertsApiLogger } from "../lib/logger.js";

const WHATSAPP_DATA_PATH = "/Users/matiassack/Documents/Matias/whatsapp-session";
const WHATSAPP_CLIENT_ID = "escuela-backend";
const WHATSAPP_USER_DATA_DIR = path.join(WHATSAPP_DATA_PATH, `session-${WHATSAPP_CLIENT_ID}`);

function killStaleBrowser(): void {
  try {
    execSync(`pkill -f "${WHATSAPP_USER_DATA_DIR}"`, { stdio: "ignore" });
    alertsApiLogger.info("WhatsApp: proceso Chrome bloqueado terminado");
  } catch { /* no había proceso, OK */ }
  // Eliminar lock files que Chrome deja al cerrarse de golpe
  for (const lockFile of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    try { fs.rmSync(path.join(WHATSAPP_USER_DATA_DIR, lockFile)); } catch {}
  }
}

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

  // Matar cualquier Chrome sobrante antes de iniciar, para evitar "browser is already running"
  killStaleBrowser();

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: WHATSAPP_CLIENT_ID,
      dataPath: WHATSAPP_DATA_PATH,
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

  client.initialize().catch(async (err: any) => {
    const msg = String(err);
    if (msg.includes("browser is already running")) {
      alertsApiLogger.warn("WhatsApp: browser bloqueado al inicializar, limpiando y reintentando...");
      initializing = false;
      if (client) { try { await client.destroy(); } catch {} }
      client = null;
      killStaleBrowser();
      setTimeout(() => initClient().catch(() => {}), 2_000);
    } else {
      initializing = false;
      alertsApiLogger.error("Error inicializando WhatsApp Web", { error: msg });
    }
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

    // Si la conexión interna quedó rota (frame o comms sin iniciar), reiniciar cliente y reintentar
    if (msg.includes("detached Frame") || msg.includes("startComms")) {
      alertsApiLogger.warn("Conexión WhatsApp rota, reintentando con nuevo cliente", { error: msg });
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

