import { appLogger } from "../lib/logger.js";

export type ParsedContestItem = {
  subjectName?: string;
  hoursToCover?: number;
};

export type ParsedContestFields = {
  publicationDate?: Date;
  contestDate?: Date;
  level?: string;
  shift?: string;
  schedule?: string;
  schoolName?: string;
  items: ParsedContestItem[];
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
  for (const m of text.matchAll(/(?:^|\n|[.;,:]\s+)\s*[•*\-]?\s*(\d{1,2})\s*hs?\b\.?(?!\s*(?:de?\s*)?\d{1,2}[:.]\d{2})/gim)) {
    const n = Number(m[1]);
    if (!Number.isNaN(n) && n > 0) candidates.push(n);
  }
  if (!candidates.length) return undefined;
  let total = 0;
  for (const n of candidates) total += n;
  return total > 0 ? total : undefined;
}

function cleanSubject(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ");
  s = s.split(/\b(?:stf|supl|titular|interino|turno|t[.\s]*ma[nñ]ana|t[.\s]*tarde|tm|tt|tn)\b/i)[0];
  // "er" agregado a sufijos ordinales para cubrir "1er", "3er"
  s = s.replace(/\b\d{1,2}\s*(?:°|º|er|ro|do|to)?\s*(?:a[nñ]o)?(?:\s+[a-z])?\b.*$/i, "");
  s = s.replace(/\b(?:co|t|orientad[ao]|modalidad|com[uú]n)\b.*$/i, "");
  s = s.replace(/[–\-:;,.\s]+$/g, "").trim();
  // Quitar comillas que quedan al extraer texto entre comillas de avisos de institutos
  s = s.replace(/["'«»""]+/g, "").trim();
  return s;
}

function extractUnidadCurricular(line: string): string | undefined {
  const m = line.match(/\bunidad\s+curricular\s*:\s*([^\n.]+)\b/i);
  if (!m) return undefined;
  const candidate = cleanSubject(m[1]);
  if (candidate.length >= 3 && candidate.length <= 120) return candidate;
  return undefined;
}

function extractSubjectName(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const uc = extractUnidadCurricular(line);
    if (uc) return uc;
  }

  for (const line of lines) {
    const m = line.match(/(?:^|[.;,:]\s+)\s*[•*\-]?\s*(\d{1,2})\s*hs?\b\.?[:\s-]*(.+)$/i);
    if (!m) continue;
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
    const m = line.match(/(?:^|[.;,:]\s+)\s*[•*\-]?\s*(\d{1,2})\s*HC\b\.?[:\s-]*(.+)$/i);
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
    const m = line.match(/\bcargo\s+([a-záéíóúñ][a-záéíóúñ\s]+?)(?:\s+\b(?:tm|tt|tn|stf|supl|titular|interino)\b|[.;,-]|$)/i);
    if (!m) continue;
    const tail = cleanSubject(m[1].trim().replace(/\s+/g, " "));
    if (tail.length >= 3 && tail.length <= 120) return tail;
  }

  return undefined;
}

/**
 * Extrae todos los items (materia + horas) de un texto de concurso.
 * Devuelve un array con una entrada por cada línea que identifica una materia/cargo.
 * Si no encuentra patrón multi-item, devuelve un array con el resultado de la
 * extracción de materia/horas única.
 */
export function extractContestItems(text: string): ParsedContestItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: ParsedContestItem[] = [];

  for (const line of lines) {
    const ucName = extractUnidadCurricular(line);

    // "2 HC MATEMÁTICA – 3° 1° – STF – T. TARDE"
    const hcMatch = line.match(/^[•*\-–—]?\s*(\d{1,2})\s*HC\b\.?[:\s\-]*(.+)/i);
    if (hcMatch) {
      const hours = Number(hcMatch[1]);
      const raw = hcMatch[2]
        .split(/\s*[–\-]\s*|\bSTF\b|\bSUPL\b|titular|turno|t\.\s*ma[nñ]ana|t\.\s*tarde/i)[0]
        .trim();
      const subject = ucName ?? cleanSubject(raw);
      if (subject.length >= 3 && !(/^c[aá]tedra?s?\b/i.test(subject))) {
        items.push({ subjectName: subject, hoursToCover: hours > 0 ? hours : undefined });
        continue;
      }
    }

    // "04 hs Maestra Domiciliaria Hospitalaria..."
    // También cubre formato institutos: "2ºAño 03 HS. Práctica Docente II"
    // El prefijo de año (ej. "2ºAño", "1er. Año") se ignora antes del número de horas.
    const hsMatch = line.match(/^(?:[•*\-–—]?\s*(?:\d+[°º]?\.?\s*(?:[a-z]+\.)?\s*[Aa][ñn]o\.?\s+)?)?[•*\-–—]?\s*(\d{1,2})\s*hs?\b\.?[:\s\-]*(.+)/i);
    if (hsMatch) {
      // Evitar horas de reloj: "a las 10:30 hs"
      if (/^\d{1,2}[:.]\d{2}/.test(hsMatch[2].trimStart())) continue;
      const hours = Number(hsMatch[1]);
      const raw = hsMatch[2]
        .split(/[.;]|Modalidad|\bSTF\b|Turno|horario|\(Formato|\bCar[aá]cter\b/i)[0]
        .trim();
      const subject = ucName ?? cleanSubject(raw);
      if (subject.length >= 3 && !(/^c[aá]tedra?s?\b/i.test(subject))) {
        items.push({ subjectName: subject, hoursToCover: hours > 0 ? hours : undefined });
        continue;
      }
    }

    // "1 Cargo del perfil: Marroquinería. Larroque. Desde ..."
    const perfilMatch = line.match(/(\d+)\s+[Cc]argo\s+del\s+perfil:\s+([^.\n]+)/i);
    if (perfilMatch) {
      const hours = Number(perfilMatch[1]);
      const subject = cleanSubject(perfilMatch[2]);
      if (subject.length >= 3) {
        items.push({ subjectName: subject, hoursToCover: hours > 0 ? hours : undefined });
        continue;
      }
    }

    // "Maestro de Tecnología Escuela N°20 NEP – STF – Turno Tarde"
    const maestroMatch = line.match(/[Mm]aestro\s+de\s+([A-Za-záéíóúñ][A-Za-záéíóúñ\s]+?)(?:\s+(?:en\s+)?(?:Escuela|UENI|N[°º]|NEP)|\s*[-–]\s*(?:STF|turno)|$)/i);
    if (maestroMatch) {
      const subject = cleanSubject(maestroMatch[1]);
      if (subject.length >= 3) {
        items.push({ subjectName: subject });
        continue;
      }
    }

    // "6 horas en el espacio curricular Idioma Inglés"
    const espacioMatch = line.match(/(\d{1,2})\s+horas?\s+en\s+el\s+espacio\s+curricular\s+(?:Idioma\s+)?(.+?)(?:\s*STF|\s*[-–]|$)/i);
    if (espacioMatch) {
      const hours = Number(espacioMatch[1]);
      const subject = cleanSubject(espacioMatch[2]);
      if (subject.length >= 3) {
        items.push({ subjectName: subject, hoursToCover: hours > 0 ? hours : undefined });
        continue;
      }
    }

    // "1 CARGO DE PRECEPTOR STF" / "1 Cargo de Jefe de Enseñanza y Producción 2da categoría -STF"
    // Diferente del "Cargo del perfil:" — aquí el cargo va directo después de "de".
    const cargoDeMatch = line.match(/^[•*\-]?\s*(\d+)\s+[Cc]argo\s+de\s+([A-Za-záéíóúñ][A-Za-záéíóúñ\s,]+?)(?:\s+\d|\s*[-–]\s*STF|\s+STF\b|$)/i);
    if (cargoDeMatch) {
      const hours = Number(cargoDeMatch[1]);
      const subject = cleanSubject(cargoDeMatch[2]);
      if (subject.length >= 3 && !/^perfil\b/i.test(subject)) {
        items.push({ subjectName: subject, hoursToCover: hours > 0 ? hours : undefined });
        continue;
      }
    }

    // "1 CARGO VICERRECTOR – STF" / "CARGO VICERRECTOR – STF- DÍAS..."
    // "Vicedirector Primera Categoría en Escuela N°8 NEP-STF"
    const viceMatch = line.match(/(?:^[•*\-]?\s*\d+\s+)?(?:CARGO\s+)?[Vv]ice(?:director[a]?|rrector)\b/i);
    if (viceMatch) {
      items.push({ subjectName: "Vicedirección" });
      continue;
    }
  }

  // Fallback: extracción de materia/horas única
  if (items.length === 0) {
    const singleSubject = extractSubjectName(text);
    const singleHours = extractHoursToCover(text);
    if (singleSubject || singleHours) {
      items.push({ subjectName: singleSubject, hoursToCover: singleHours });
    }
  }

  return items;
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
 * Enriquece los campos parseados con IA.
 *
 * Estrategia:
 * - Siempre llama a la IA para identificar materias con mayor precisión.
 * - Si la IA devuelve items, los usa (más confiables que regex para materias).
 * - Si la IA no devuelve items, conserva los del regex.
 * - Para campos globales (level, shift, schedule, contestDate): el regex tiene
 *   prioridad; la IA solo rellena lo que el regex no encontró.
 * - Si ANTHROPIC_API_KEY no está configurado, es un no-op.
 */
export async function enrichContestFieldsWithAI(
  fields: ParsedContestFields,
  rawText: string,
): Promise<ParsedContestFields> {
  const { parseContestWithAI } = await import("./ai-parser.service.js");
  const ai = await parseContestWithAI(rawText);

  const merged: ParsedContestFields = { ...fields };

  if (ai.items && ai.items.length > 0) {
    merged.items = ai.items;
    const itemsWithNotes = ai.items.filter((item) => item.textFragment || item.regexSuggestion);
    if (itemsWithNotes.length > 0) {
      appLogger.info("AI subject extraction feedback (regex mejorable)", {
        items: itemsWithNotes.map((item) => ({
          subject: item.subjectName,
          hours: item.hoursToCover,
          textFragment: item.textFragment,
          regexSuggestion: item.regexSuggestion,
        })),
      });
    }
  }

  if (!merged.shift && ai.shift) merged.shift = ai.shift;
  if (!merged.level && ai.level) merged.level = ai.level;
  if (!merged.schedule && ai.schedule) merged.schedule = ai.schedule;
  if (!merged.schoolName && ai.schoolName) merged.schoolName = ai.schoolName;
  if (!merged.contestDate && ai.contestDate) {
    const parsed = new Date(ai.contestDate);
    const pubMs = merged.publicationDate?.getTime();
    if (!Number.isNaN(parsed.getTime()) && (!pubMs || parsed.getTime() > pubMs)) {
      merged.contestDate = parsed;
      if (ai.dateNotes) {
        appLogger.info("AI date extraction feedback (regex mejorable)", { dateNotes: ai.dateNotes, contestDate: ai.contestDate });
      }
    } else if (ai.dateNotes) {
      appLogger.info("AI date extraction feedback (fecha descartada o no encontrada)", { dateNotes: ai.dateNotes, contestDate: ai.contestDate ?? null });
    }
  } else if (!merged.contestDate && ai.dateNotes) {
    appLogger.info("AI date extraction feedback (sin fecha)", { dateNotes: ai.dateNotes });
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

  // La fecha del concurso debe estar dentro del contenido del aviso y ser
  // posterior a la publicación. No usamos publicationDate como fallback aquí;
  // si no encontramos una fecha válida devolvemos undefined y el scraper usa
  // su propio fallback.
  let contestDate: Date | undefined =
    parseSpanishLongDateWithOptionalTime(fullText) ??
    parseDdMmYyyy(description) ??
    input.fallbackContestDate;

  // Refinar con hora suelta si la fecha no tiene hora
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

  // Validar que la fecha del concurso sea estrictamente posterior a la publicación.
  // Si no lo es, la extracción capturó la fecha equivocada (ej: la fecha del post).
  if (contestDate && publicationDate && contestDate.getTime() <= publicationDate.getTime()) {
    contestDate = undefined;
  }

  return {
    publicationDate,
    contestDate,
    level: detectLevel(fullText) ?? input.fallbackLevel,
    shift: detectShift(fullText),
    schedule: extractSchedule(description),
    items: extractContestItems(fullText),
  };
}
