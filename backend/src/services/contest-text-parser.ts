export type ParsedContestFields = {
  publicationDate?: Date;
  contestDate?: Date;
  level?: string;
  shift?: string;
  schedule?: string;
  hoursToCover?: number;
  subjectName?: string;
};

const MONTHS_ES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function toValidDate(year: number, month: number, day: number, hour = 0, minute = 0): Date | undefined {
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function parseDdMmYyyy(text: string): Date | undefined {
  const m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!day || !month || !year) return undefined;
  return toValidDate(year, month, day);
}

function parseSpanishLongDateWithOptionalTime(text: string): Date | undefined {
  const m = text.match(
    /\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)?\s*(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})(?:\s*,?\s*(?:a\s+las\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*hs?)?/i,
  );
  if (!m) return undefined;

  const day = Number(m[1]);
  const monthName = m[2].toLowerCase();
  const year = Number(m[3]);
  const hour = m[4] ? Number(m[4]) : 0;
  const minute = m[5] ? Number(m[5]) : 0;
  const month = MONTHS_ES[monthName];

  if (!day || !month || !year) return undefined;
  if (Number.isNaN(hour) || Number.isNaN(minute)) return undefined;
  return toValidDate(year, month, day, hour, minute);
}

function extractStandaloneHour(text: string): { hour: number; minute: number } | undefined {
  const m = text.match(/\b(?:hora|hs?)\s*[:.]?\s*(\d{1,2})(?:[:.](\d{2}))\b/i);
  if (!m) return undefined;
  const hour = Number(m[1]);
  const minute = Number(m[2] ?? "0");
  if (Number.isNaN(hour) || Number.isNaN(minute)) return undefined;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
  return { hour, minute };
}

function detectLevel(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/nivel\s+secundario|escuela\s+secundaria|secundario/.test(t)) return "secundario";
  if (/nivel\s+primario|escuela\s+primaria|primario/.test(t)) return "primario";
  if (/nivel\s+inicial|jard[ií]n|inicial/.test(t)) return "inicial";
  if (/nivel\s+superior|instituto|superior/.test(t)) return "superior";
  if (/supervisor/.test(t)) return "supervisor";
  return undefined;
}

function detectShift(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\bturno\s+ma[nñ]ana\b|\btm\b|\bt[.\s]*ma[nñ]ana\b/.test(t)) return "mañana";
  if (/\bturno\s+tarde\b|\btt\b|\bt[.\s]*tarde\b/.test(t)) return "tarde";
  if (/\bturno\s+noche\b|\bnocturno\b|\btn\b/.test(t)) return "noche";
  return undefined;
}

function extractHoursToCover(text: string): number | undefined {
  const candidates: number[] = [];
  for (const m of text.matchAll(/\b(\d{1,2})\s*HC\b/gi)) {
    const n = Number(m[1]);
    if (!Number.isNaN(n) && n > 0) candidates.push(n);
  }
  // Aceptamos "04 hs Materia..." pero evitamos horas de reloj (a las 10:30 hs).
  for (const m of text.matchAll(/(?:^|\n|[.;,:]\s+)\s*[•*\-]?\s*(\d{1,2})\s*hs?\b\.?(?!\s*(?:de?\s*)?\d{1,2}[:.]\d{2})/gim)) {
    const n = Number(m[1]);
    if (!Number.isNaN(n) && n > 0) candidates.push(n);
  }
  if (!candidates.length) return undefined;
  let total = 0;
  for (const n of candidates) total += n;
  return total > 0 ? total : undefined;
}

function extractSubjectName(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const cleanSubject = (raw: string): string => {
    let s = raw.trim().replace(/\s+/g, " ");
    // Cortes típicos que no forman parte del nombre de materia/cargo.
    s = s.split(/\b(?:stf|supl|titular|interino|turno|t[.\s]*ma[nñ]ana|t[.\s]*tarde|tm|tt|tn)\b/i)[0];
    // Remover nivel/año/división al final: "4° año B", "2do", etc.
    s = s.replace(/\b\d{1,2}\s*(?:°|º|ro|do|to)?\s*(?:a[nñ]o)?(?:\s+[a-z])?\b.*$/i, "");
    // Remover fragmentos muy comunes de modalidad/orientación.
    s = s.replace(/\b(?:co|t|orientad[ao]|modalidad|com[uú]n)\b.*$/i, "");
    // Quitar puntuación sobrante final.
    s = s.replace(/[–\-:;,.\s]+$/g, "").trim();
    return s;
  };

  const extractUnidadCurricular = (line: string): string | undefined => {
    const m = line.match(/\bunidad\s+curricular\s*:\s*([^\n.]+)\b/i);
    if (!m) return undefined;
    const candidate = cleanSubject(m[1]);
    if (candidate.length >= 3 && candidate.length <= 120) return candidate;
    return undefined;
  };

  for (const line of lines) {
    const uc = extractUnidadCurricular(line);
    if (uc) return uc;
  }

  for (const line of lines) {
    // Ej: "04 hs Maestra Domiciliaria Hospitalaria. Modalidad común..."
    const m = line.match(/(?:^|[.;,:]\s+)\s*[•*\-]?\s*(\d{1,2})\s*hs?\b\.?[:\s-]*(.+)$/i);
    if (!m) continue;
    // Si viene "Unidad Curricular: ...", la preferimos por sobre "Cátedras/Formato/..." en esa línea.
    const uc = extractUnidadCurricular(line);
    if (uc) return uc;
    const tail = cleanSubject(
      m[2]
      .split(/[.;]|Modalidad|STF|Turno|horario/i)[0]
      .trim()
      .replace(/\s+/g, " "),
    );
    if (/^c[aá]tedra?s?\b/i.test(tail)) continue;
    if (tail.length >= 3 && tail.length <= 120) return tail;
  }

  for (const line of lines) {
    // Ej: "2 HC FISICA Y QUIMICA – 2° 2° – STF – T. TARDE"
    const m = line.match(/(?:^|[.;,:]\s+)\s*[•*\-]?\s*(\d{1,2})\s*HC\b\.?[:\s-]*(.+)$/i);
    if (!m) continue;
    const uc = extractUnidadCurricular(line);
    if (uc) return uc;
    const tail = cleanSubject(
      m[2]
      .split(/[–-]|STF|SUPL|titular|turno|t\.\s*ma[nñ]ana|t\.\s*tarde/i)[0]
      .trim()
      .replace(/\s+/g, " "),
    );
    if (tail.length >= 3 && tail.length <= 120) return tail;
  }

  for (const line of lines) {
    // Ej: "Cargo Preceptor TT STF ..."
    const m = line.match(/\bcargo\s+([a-záéíóúñ][a-záéíóúñ\s]+?)(?:\s+\b(?:tm|tt|tn|stf|supl|titular|interino)\b|[.;,-]|$)/i);
    if (!m) continue;
    const tail = cleanSubject(m[1].trim().replace(/\s+/g, " "));
    if (tail.length >= 3 && tail.length <= 120) return tail;
  }

  return undefined;
}

function extractSchedule(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const picked = lines.filter((l) =>
    /(hs\b|hora|horas|a\s+las\s+\d|turno|lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)/i.test(l),
  );
  const joined = picked.join("\n").trim();
  return joined || undefined;
}

/**
 * Enriches regex-parsed fields with AI when critical fields are missing.
 *
 * Strategy:
 * - AI is called only when subjectName OR hoursToCover are missing from regex.
 * - Regex results take priority: AI only fills empty slots.
 * - contestDate from AI is parsed and used only if regex did not find one.
 * - If ANTHROPIC_API_KEY is not set, this is a no-op.
 */
export async function enrichContestFieldsWithAI(
  fields: ParsedContestFields,
  rawText: string,
): Promise<ParsedContestFields> {
  const needsAI = !fields.subjectName || !fields.hoursToCover;
  if (!needsAI) return fields;

  // Lazy import to avoid loading the SDK when AI is not needed
  const { parseContestWithAI } = await import("./ai-parser.service.js");
  const ai = await parseContestWithAI(rawText);

  const merged: ParsedContestFields = { ...fields };

  if (!merged.subjectName && ai.subjectName) {
    merged.subjectName = ai.subjectName;
  }
  if (!merged.hoursToCover && ai.hoursToCover) {
    merged.hoursToCover = ai.hoursToCover;
  }
  if (!merged.shift && ai.shift) {
    merged.shift = ai.shift;
  }
  if (!merged.level && ai.level) {
    merged.level = ai.level;
  }
  if (!merged.schedule && ai.schedule) {
    merged.schedule = ai.schedule;
  }
  if (!merged.contestDate && ai.contestDate) {
    const parsed = new Date(ai.contestDate);
    if (!Number.isNaN(parsed.getTime())) {
      merged.contestDate = parsed;
    }
  }

  return merged;
}

export function extractContestFieldsFromText(input: {
  title?: string;
  description?: string;
  fallbackPublicationDate?: Date;
  fallbackContestDate?: Date;
  fallbackLevel?: string;
}): ParsedContestFields {
  const title = input.title ?? "";
  const description = input.description ?? "";
  const fullText = `${title}\n${description}`.trim();

  const publicationDate = parseDdMmYyyy(fullText) ?? input.fallbackPublicationDate;
  let contestDate =
    parseSpanishLongDateWithOptionalTime(fullText) ??
    parseDdMmYyyy(description) ??
    input.fallbackContestDate ??
    publicationDate;

  // Si la fecha vino sin hora, intentamos completar con "HORA 11:00" u otros formatos.
  if (contestDate && contestDate.getHours() === 0 && contestDate.getMinutes() === 0) {
    const standaloneHour = extractStandaloneHour(fullText);
    if (standaloneHour) {
      contestDate = toValidDate(
        contestDate.getFullYear(),
        contestDate.getMonth() + 1,
        contestDate.getDate(),
        standaloneHour.hour,
        standaloneHour.minute,
      );
    }
  }

  return {
    publicationDate,
    contestDate,
    level: detectLevel(fullText) ?? input.fallbackLevel,
    shift: detectShift(fullText),
    schedule: extractSchedule(description),
    hoursToCover: extractHoursToCover(fullText),
    subjectName: extractSubjectName(fullText),
  };
}
