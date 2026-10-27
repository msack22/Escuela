import type { PrismaClient } from "@prisma/client";
import { appLogger } from "../lib/logger.js";

const PADRON_URL =
  "https://www.argentina.gob.ar/sites/default/files/2026.01.12_padron_oficial_establecimientos_educativos_die.xlsx";

/**
 * Normaliza un string de CUE a exactamente 9 dígitos (formato del padrón oficial).
 * El padrón usa cueanexo de 9 dígitos; en los avisos aparece sin los 2 últimos (anexo "00").
 * Ejemplos:
 *   "3002682"   → "300268200"
 *   "300268200" → "300268200"
 *   "300-2682"  → "300268200"
 */
export function normalizeCue(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 7) return digits + "00";
  if (digits.length === 8) return digits + "0";
  return digits; // 9 or more — return as-is
}

/** Extrae el primer CUE de Entre Ríos que aparezca en el texto. */
export function extractCueFromText(text: string): string | null {
  // Formatos frecuentes: CUE 3002682 / CUE: 300-2682 / CUE:300007400
  const match = text.match(/CUE[:\s#]+([0-9][\d\-]{5,10})/i);
  if (!match) return null;
  const normalized = normalizeCue(match[1]);
  // Solo Entre Ríos (empieza con 30)
  if (!normalized.startsWith("30")) return null;
  return normalized;
}

/** Busca un CUE en la tabla padron_escuelas y devuelve departamento y localidad. */
export async function lookupCue(
  prisma: PrismaClient,
  cueanexo: string,
): Promise<{ departamento: string; localidad: string; nombre: string } | null> {
  const row = await prisma.padronEscuela.findUnique({
    where: { cueanexo },
    select: { departamento: true, localidad: true, nombre: true },
  });
  return row ?? null;
}

// Palabras genéricas que no sirven para identificar una escuela específica.
const STOP_WORDS = new Set([
  "escuela", "colegio", "instituto", "centro", "secundaria", "primaria", "inicial",
  "superior", "tecnica", "agrotecnica", "normal", "adultos", "jovenes", "educacion",
  "orientada", "especial", "integral", "municipal", "provincial", "nacional",
  "privado", "privada", "publico", "publica",
  "de", "del", "la", "los", "las", "el", "y", "en", "por", "con", "para",
  "doctor", "dra", "ing", "prof", "profesor", "profesora", "lic",
  "gral", "general", "don", "doña", "san", "santa", "cabo", "sargento",
  "eet", "eeat", "esja", "nina", "nep", "esba", "asja",
  "colonia", "aldea", "paraje", "anexo", "priv",
  "jose", "maria", "juan", "luis", "carlos", "antonio", "angel",
]);

/**
 * Extrae palabras "distintivas" del nombre de una escuela para buscar en el padrón.
 * Elimina palabras genéricas (tipos de escuela, artículos, títulos) y números,
 * quedando con apellidos y palabras únicas que identifican el establecimiento.
 */
export function extractDistinctiveWords(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")     // quitar acentos
    .replace(/[°º""'"'´`.,;:()\[\]{}&\-–]/g, " ")          // reemplazar puntuación
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * Extrae el número de escuela del nombre (N° 13, Nº 79, No 04, etc.).
 * El padrón pone el número al final del nombre ("Zubiaur Tecnica 79").
 */
export function extractSchoolNumber(name: string): number | null {
  const m = name.match(/[Nn][°oOº]\.?\s*(\d{1,4})\b/);
  if (m) return parseInt(m[1], 10);
  const trailing = name.match(/\b(\d{1,4})\s*(?:[,"\s]|$)/);
  if (trailing) return parseInt(trailing[1], 10);
  return null;
}

/**
 * Busca en el padrón una escuela que coincida unívocamente con el nombre dado.
 * Requiere que el número de escuela coincida (si está presente) Y que haya al menos
 * una palabra distintiva en común. Si hay más de un match → devuelve null (ambiguo).
 */
export async function lookupByName(
  prisma: PrismaClient,
  schoolName: string,
): Promise<{ departamento: string; localidad: string; nombre: string } | null> {
  const words = extractDistinctiveWords(schoolName);
  const num   = extractSchoolNumber(schoolName);

  if (words.length === 0 && num === null) return null;

  // Obtener todos los registros del padrón para Entre Ríos (ya están todos importados)
  const allRows = await prisma.padronEscuela.findMany({
    select: { cueanexo: true, nombre: true, departamento: true, localidad: true },
  });

  const matches: typeof allRows = [];

  for (const row of allRows) {
    const padronNorm = row.nombre
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");

    // Verificar coincidencia de número si existe
    if (num !== null) {
      // El padrón pone el número al final: "... Zubiaur Tecnica 79"
      const padronNum = row.nombre.match(/\b(\d{1,4})\s*$/)?.[1];
      if (!padronNum || parseInt(padronNum, 10) !== num) continue;
    }

    // Verificar que al menos UNA palabra distintiva esté en el nombre del padrón
    const hasMatch = words.some((w) => padronNorm.includes(w));
    if (!hasMatch && words.length > 0) continue;

    // Si llegó acá, es candidato
    matches.push(row);
  }

  // Solo usar si hay exactamente 1 coincidencia (evitar ambigüedades)
  if (matches.length === 1) return { departamento: matches[0].departamento, localidad: matches[0].localidad, nombre: matches[0].nombre };
  return null;
}

/** Capitaliza un string en mayúsculas: "GUALEGUAYCHU" → "Gualeguaychú" usando un mapa de correcciones. */
function titleCase(str: string): string {
  const CORRECTIONS: Record<string, string> = {
    GUALEGUAYCHU: "Gualeguaychú",
    GUALEGUAYCHÚ: "Gualeguaychú",
    GUALEGUAY: "Gualeguay",
    CONCORDIA: "Concordia",
    PARANA: "Paraná",
    PARANÃ: "Paraná",
    VILLAGUAY: "Villaguay",
    NOGOYA: "Nogoyá",
    NOGOYÁ: "Nogoyá",
    COLON: "Colón",
    COLÓN: "Colón",
    FEDERACION: "Federación",
    FEDERACIÓN: "Federación",
    FEDERAL: "Federal",
    URUGUAY: "Uruguay",
    VICTORIA: "Victoria",
    "LA PAZ": "La Paz",
    FELICIANO: "Feliciano",
    DIAMANTE: "Diamante",
    TALA: "Tala",
    "SAN SALVADOR": "San Salvador",
    "ISLAS DEL IBICUY": "Islas del Ibicuy",
  };
  const upper = str.toUpperCase().trim();
  if (CORRECTIONS[upper]) return CORRECTIONS[upper];
  return str
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del")
    .replace(/\bLa\b/g, "la")
    .replace(/\bEl\b/g, "el")
    .replace(/\bLos\b/g, "los")
    .replace(/\bLas\b/g, "las");
}

/**
 * Descarga el padrón oficial del Ministerio de Educación y actualiza la tabla padron_escuelas.
 * Filtra solo los establecimientos de Entre Ríos (jurisdicción contiene "entre").
 * Usa UPSERT para no duplicar ni borrar registros existentes.
 */
export async function importPadronEscuelas(
  prisma: PrismaClient,
  onProgress?: (msg: string) => void,
): Promise<{ inserted: number; updated: number; total: number }> {
  const log = (msg: string) => {
    appLogger.info(msg);
    onProgress?.(msg);
  };

  log("Descargando padrón oficial de establecimientos educativos...");

  // Dynámicamente importamos xlsx (no queremos que sea dep de tiempo de arranque)
  const XLSX = await import("xlsx");

  const response = await fetch(PADRON_URL, {
    headers: { "User-Agent": "EscuelaConcursosApp/1.0" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} descargando padrón`);

  const buffer = Buffer.from(await response.arrayBuffer());
  log(`Padrón descargado (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Procesando...`);

  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Encontrar fila de headers (contiene "Cueanexo")
  let headerIdx = -1;
  for (let i = 0; i < rawRows.length; i++) {
    if (rawRows[i].some((v) => String(v).toLowerCase().includes("cueanexo"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error("No se encontró la fila de headers en el padrón");

  const headers = rawRows[headerIdx].map((v) => String(v).trim().toLowerCase());
  const col = (name: string) => headers.findIndex((h) => h.includes(name));

  const iJur = col("jurisdicci");
  const iCue = col("cueanexo");
  const iNom = col("nombre");
  const iDep = col("departamento");
  const iLoc = col("localidad");
  const iSec = col("sector");
  const iAmb = col("ámbito") >= 0 ? col("ámbito") : col("ambito");
  const iDom = col("domicilio");
  const iCp  = col("c. p") >= 0 ? col("c. p") : col("cp");
  const iTel = col("teléfono") >= 0 ? col("teléfono") : col("telefono");

  let inserted = 0, updated = 0, total = 0;
  const dataRows = rawRows.slice(headerIdx + 1);

  for (const row of dataRows) {
    const jur = String(row[iJur] ?? "").toLowerCase();
    if (!jur.includes("entre")) continue;

    const cueanexo = String(row[iCue] ?? "").trim().replace(/\D/g, "");
    if (!cueanexo || cueanexo.length < 7) continue;

    const nombre      = titleCase(String(row[iNom] ?? "").trim());
    const departamento = titleCase(String(row[iDep] ?? "").trim());
    const localidad    = titleCase(String(row[iLoc] ?? "").trim());
    const sector       = String(row[iSec] ?? "").trim() || null;
    const ambito       = String(row[iAmb] ?? "").trim() || null;
    const domicilio    = String(row[iDom] ?? "").trim() || null;
    const cp           = String(row[iCp]  ?? "").trim() || null;
    const telefono     = String(row[iTel] ?? "").trim() || null;

    if (!nombre || !departamento || !localidad) continue;

    const existing = await (prisma as any).padronEscuela.findUnique({ where: { cueanexo } });
    if (existing) {
      await (prisma as any).padronEscuela.update({
        where: { cueanexo },
        data: { nombre, departamento, localidad, sector, ambito, domicilio, cp, telefono },
      });
      updated++;
    } else {
      await (prisma as any).padronEscuela.create({
        data: { cueanexo, nombre, departamento, localidad, sector, ambito, domicilio, cp, telefono },
      });
      inserted++;
    }
    total++;
  }

  log(`Importación completada: ${inserted} nuevos, ${updated} actualizados, ${total} total.`);
  return { inserted, updated, total };
}
