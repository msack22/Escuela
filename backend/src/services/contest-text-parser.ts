import { appLogger } from "../lib/logger.js";

export type ParsedContestItem = {
  subjectName?: string;
  hoursToCover?: number;
  grade?: string;
  llamado?: string;
  caracter?: string;
};

export type ParsedContestFields = {
  publicationDate?: Date;
  contestDate?: Date;
  level?: string;
  shift?: string;
  schedule?: string;
  schoolName?: string;
  city?: string;
  department?: string;
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
  // Quitar separadores y preposiciones al inicio
  s = s.replace(/^[–\-:;,\s]+/, "");
  // Quitar sufijos de género dual: "Bibliotecario/a" → "Bibliotecario"
  s = s.replace(/\/[aAoO]s?\b/g, "");
  s = s.replace(/^(?:c[aá]tedras?\s+de\s+|de\s+)/i, "");
  s = s.split(/\b(?:stf|supl|titular|interino|turno|t[.\s]*ma[nñ]ana|t[.\s]*tarde|tm|tt|tn)\b/i)[0];
  // Ordinal grades: "3°", "3er", "3ro", "3do", "3to" y también "NoNo" (ej: "3o2o", "1o1o")
  s = s.replace(/\b\d{1,2}\s*(?:°|º|er|ro|do|to|vo|mo|no|ra)?\s*(?:a[nñ]o)?(?:\s+[a-z])?\b.*$/i, "");
  s = s.replace(/\b\d+o\d+o\b.*$/i, "");  // formato "1o1o", "3o2o" (año + división)
  // "co" (C.O. = ciclo orientado) y siglas similares. NO usar \bt\b porque matchea "T" en "Técnico" (é no es \w)
  s = s.replace(/\b(?:co|cb|orientad[ao]|modalidad|com[uú]n)\b.*$/i, "");
  s = s.replace(/[–\-:;,.\s]+$/g, "").trim();
  // Quitar sufijos de preposición que quedan al cortar en el grado ("Historia de", "Biología en")
  s = s.replace(/\s+(?:de[l]?|en|la|el|los|las|y)\s*$/gi, "").trim();
  // Quitar comillas que quedan al extraer texto entre comillas de avisos de institutos
  s = s.replace(/["'«»""]+/g, "").trim();
  return s;
}

function extractUnidadCurricular(line: string): string | undefined {
  // Cubre "Unidad Curricular:" y "Espacio Curricular:" (formato institutos/tecnicaturas)
  const m = line.match(/\b(?:unidad|espacio)\s+curricular\s*:\s*([^\n.]+)\b/i);
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
/** Extrae el Carácter (SUPLENTE/TITULAR/INTERINO) de las líneas siguientes a un item. */
function extractCaracterFromContext(lines: string[], afterIndex: number): string | undefined {
  for (let j = afterIndex; j < Math.min(afterIndex + 5, lines.length); j++) {
    const m = lines[j].match(/^Car[aá]cter\s+(.+)/i);
    if (m) return m[1].trim();
  }
  return undefined;
}

export function extractContestItems(text: string): ParsedContestItem[] {
  // Normalizar formato inline (htmlToText colapsa en una línea): insertar \n antes de cada
  // item que empiece con patrón de horas. NO tocar tiempos de reloj (HH.MM / HH:MM).
  //
  // Caso 1: "N hs. (STF)" / "N HORAS "
  // Caso 2: "N h [Capital]" / "N h [grade_ref como 1o1o]" — formato EEAT (sin "ORAS")
  //   Distinción: "14.50 h" es un reloj (tiene decimal antes de h), "10 h" son horas cobertura.
  //   `\b\d{1,2}\s+h\s+` falla para "14.50 h" porque tras "14" viene "." no espacio.
  // Caso 3: "Un cargo de " — aparece en bloques EEAT sin número de horas.
  const normalized = text
    .replace(/(?<!\d:\d{2})\s+(?=\d{1,2}\s*hs?[.\s]\s*\(STF\))/gi, "\n")
    .replace(/(?<!\d:\d{2})\s+(?=\d{1,2}\s+HORAS?\s)/gi, "\n")
    .replace(/\s+(?=\b\d{1,2}\s+h\s+(?:[A-ZÁÉÍÓÚÑ]|\d+o\d+o|[Uu]n\s+cargo))/g, "\n")
    .replace(/\s+(?=[Uu]n\s+cargo\s+de\s+)/g, "\n")
    // "01 Cargo Bibliotecario/a", "02 Cargo Preceptor" — número + Cargo + nombre directo (sin "de")
    .replace(/\s+(?=\b\d+\s+[Cc]argo\s+[A-ZÁÉÍÓÚÑ])/g, "\n")
    // "N HC MATEMÁTICA", "N HS DE INGLÉS", "2hs Tecnología" — Nhs/N HC/N HS sin HORAS
    // Lookbehind (?<![.,]\d{2}) excluye tiempos de reloj como "12,30 hs" o "12.30 hs"
    .replace(/(?<![.,]\d{2})\s+(?=[•*\-–—]?\s*\d{1,2}\s*(?:[Hh][Cc]|[Hh][Ss]?)\b\.?\s+(?:[Dd][Ee]\s+)?[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ]{2,})/g, "\n")
    // "N hs 1er Año – Materia" — grado antes de materia
    .replace(/(?<![.,]\d{2})\s+(?=\b\d{1,2}\s*[Hh][Ss]?\b\.?\s+\d+[°º]?(?:er|ro|do|to|vo|mo|no|ra)\b)/g, "\n")
    // "CARGO: Orientador/a" — etiqueta de cargo
    .replace(/\s+(?=[Cc][Aa][Rr][Gg][Oo]\s*:)/g, "\n")
    // "09:00 h. MATERIA" — hora reloj + h. + materia en mayúsculas (ENS Mariano Moreno)
    .replace(/\s+(?=\d{1,2}:\d{2}\s+h[.\s]\s+[A-ZÁÉÍÓÚÑ]{3,})/g, "\n")
    // "A las 8:15 hs de LENGUA Y LITERATURA" — hora reloj + "de" + materia
    .replace(/\s+(?=[Aa]\s+las\s+\d{1,2}[:.]\d{2}\s+hs?\s+de\s+[A-ZÁÉÍÓÚÑ])/g, "\n");

  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: ParsedContestItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ucName = extractUnidadCurricular(line);

    // "2 HORAS TECNOLOGÍA 2do 1ra (Primer llamado)"  ← formato CGE EET
    const horasMatch = line.match(/^[•*\-–—]?\s*(\d{1,2})\s+HORAS?\b\.?\s*(.+)/i);
    if (horasMatch && !/^\d{1,2}[:.]\d{2}/.test(horasMatch[2].trimStart())) {
      const hours = Number(horasMatch[1]);
      const rest = horasMatch[2];

      const llamadoMatch = rest.match(/\(\s*([^)]*llamado[^)]*)\s*\)/i);
      const llamado = llamadoMatch ? llamadoMatch[1].trim() : undefined;
      const withoutLlamado = rest.replace(/\s*\([^)]+\)/g, "").trim();

      // Grade: Ndo/Nto/Nra + optional division + optional shift code (TV/TM/TN)
      const gradeIdx = withoutLlamado.search(/\b\d+[°º]?(?:er|ro|do|to|vo|mo|no|ra)?\b/i);
      let subjectRaw: string;
      let grade: string | undefined;
      if (gradeIdx > 0) {
        subjectRaw = withoutLlamado.slice(0, gradeIdx);
        const gradeStr = withoutLlamado.slice(gradeIdx);
        // Solo tomar la parte del grado: Ndo + división + turno, no el resto de la línea
        const gradeOnly = gradeStr.match(/^(\d+[°º]?(?:[a-z]+)?(?:\s+\d+[a-z]+)?(?:\s+(?:TV|TM|TN|TT|STV))?)/i);
        grade = gradeOnly?.[1]?.trim() || undefined;

        // Buscar Carácter también dentro de la misma línea (formato inline)
        const caracInline = gradeStr.match(/Car[aá]cter\s+(.+?)(?:\s+D[ií]as\s+y\s+horario|\s*Día|\s*$)/i);
        var caracResult = caracInline?.[1]?.trim() ?? undefined;
      } else {
        subjectRaw = withoutLlamado;
        var caracResult = undefined as string | undefined;
      }

      const subject = cleanSubject(subjectRaw);
      const caracter = caracResult ?? extractCaracterFromContext(lines, i + 1);

      if (subject.length >= 3) {
        items.push({ subjectName: subject, hoursToCover: hours > 0 ? hours : undefined, grade, llamado, caracter });
        continue;
      }
    }

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

    // "09:00 h. LENGUA Y LITERATURA" — hora reloj + h. + materia (ENS Mariano Moreno)
    const timeSubjectMatch = line.match(/^(\d{1,2}:\d{2})\s+h[.\s]\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:\s+(?:Instancia|Primer|Segundo|Tercer)|[.,]|$)/i);
    if (timeSubjectMatch && !/^(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i.test(timeSubjectMatch[2])) {
      const subject = cleanSubject(timeSubjectMatch[2]);
      if (subject.length >= 3) {
        items.push({ subjectName: subject });
        continue;
      }
    }

    // "A las 8:15 hs de LENGUA Y LITERATURA (...)" — hora de concurso + "de" + materia
    const aLasMatch = line.match(/^[Aa]\s+las\s+\d{1,2}[:.]\d{2}\s+hs?\s+de\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:\s*\(|\s+\d+\s+hs?\b|[.,]|$)/i);
    if (aLasMatch) {
      const subject = cleanSubject(aLasMatch[1]);
      if (subject.length >= 3) {
        items.push({ subjectName: subject });
        continue;
      }
    }

    // "04 hs Maestra Domiciliaria Hospitalaria..."
    // También cubre formato institutos: "2ºAño 03 HS. Práctica Docente II"
    // El prefijo de año (ej. "2ºAño", "1er. Año") se ignora antes del número de horas.
    const hsMatch = line.match(/^(?:[•*\-–—]?\s*(?:\d+[°º]?\.?\s*(?:[a-z]+\.)?\s*[Aa][ñn]o\.?\s+)?)?[•*\-–—]?\s*(\d{1,2})\s*(?:h\b|hs?\b)\.?[:\s\-]*(.+)/i);
    if (hsMatch) {
      // Evitar horas de reloj: "a las 10:30 hs"
      if (/^\d{1,2}[:.]\d{2}/.test(hsMatch[2].trimStart())) continue;
      // Líneas de distribución por división: "2 h 1o1o lunes..." — son horarios, no materias
      if (/^\d+o\d+o\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)/i.test(hsMatch[2].trimStart())) continue;
      // Líneas que empiezan con día de la semana: "2 hs Viernes de 9 a 10" — son horarios
      if (/^(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i.test(hsMatch[2].trimStart())) continue;
      const hours = Number(hsMatch[1]);
      // Stripear paréntesis iniciales como "(STF)" que aparecen antes de la materia
      const withoutLeadingParen = hsMatch[2].replace(/^\s*\([^)]*\)\s*/, "");
      // Detectar formato "grado - materia": "1er Año B - Formación Ética y Ciudadana"
      // Nota: \w no incluye caracteres acentuados como "ñ", por eso se usa A[nñ]o para "Año".
      const gradeFirstMatch = withoutLeadingParen.match(
        /^\d+[°º]?(?:er|ro|do|to|vo|mo|no|ra)?(?:\s+A[nñ]o)?(?:\s+[A-Za-z])?\s*[–\-]+\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s,]+)/i
      );
      const toSplit = gradeFirstMatch ? gradeFirstMatch[1] : withoutLeadingParen;
      const raw = toSplit
        // No split en "." si está precedido por letra mayúscula sola (sigla: C.B., C.O.)
        // ":" indica etiqueta (ej: "CARGO O:") — no es parte del nombre de la materia.
        .split(/(?<![A-Z])\.|;|:|Modalidad|\bSTF\b|Turno|horario|\(Formato|\bCar[aá]cter\b/i)[0]
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
    // "Maestro/a de Ciclo en Escuela N°6 NINA/NEP -STF-" — también con sufijo de género "/a"
    const maestroMatch = line.match(/[Mm]aestr[oa](?:\/[ao])?\s+de\s+([A-Za-záéíóúñ][A-Za-záéíóúñ\s]+?)(?:\s+(?:en\s+)?(?:Escuela|UENI|N[°º]|NEP)|\s*[-–]\s*(?:STF|turno)|$)/i);
    if (maestroMatch) {
      // Se conserva el prefijo "Maestro de " porque getSubjectGroupName usa patrones
      // como /^Maestr[ao]\s+de\s+Ciclo/i para agrupar (Ciclo/Grado/Apoyo); si se
      // descartaba el prefijo, esos patrones nunca matcheaban.
      const rest = cleanSubject(maestroMatch[1]);
      if (rest.length >= 3) {
        items.push({ subjectName: `Maestro de ${rest}` });
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

    // "01 Cargo Bibliotecario/a" / "02 Cargo Preceptor" — sin "de" entre Cargo y el nombre
    const cargoDirectMatch = line.match(/^[•*\-–—]?\s*\d+\s+[Cc]argo\s+([A-Za-záéíóúñ\/][A-Za-záéíóúñ\s\/]+?)(?:\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|turno|STF|en\s)|[,.]|$)/i);
    if (cargoDirectMatch) {
      const subject = cleanSubject(cargoDirectMatch[1]);
      if (subject.length >= 3 && !/^de\b/i.test(subject)) {
        items.push({ subjectName: subject, hoursToCover: 1 });
        continue;
      }
    }

    // "CARGO: Orientador/a educacional perfil Psicológico" — etiqueta CARGO: al inicio de línea
    const cargoLabelMatch = line.match(/^CARGO\s*:\s*([A-Za-záéíóúñ\/][A-Za-záéíóúñ\s\/]+?)(?:\s+(?:STF|turno|perfil|en\s)|[,.]|$)/i);
    if (cargoLabelMatch) {
      const subject = cleanSubject(cargoLabelMatch[1]);
      if (subject.length >= 3) {
        items.push({ subjectName: subject, hoursToCover: 1 });
        continue;
      }
    }

    // "Un cargo de Preceptor turno mañana" / "un cargo de Orientador/a educacional"
    const unCargoMatch = line.match(/^[Uu]n\s+cargo\s+de\s+([A-Za-záéíóúñ\/][A-Za-záéíóúñ\s\/]+?)(?:\s+(?:turno|STF|en\s+)|[,.]|$)/i);
    if (unCargoMatch) {
      const subject = cleanSubject(unCargoMatch[1]);
      if (subject.length >= 3) {
        items.push({ subjectName: subject, hoursToCover: 1 });
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
  if (!merged.city && ai.city) merged.city = ai.city;
  if (!merged.department && ai.department) merged.department = ai.department;
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
