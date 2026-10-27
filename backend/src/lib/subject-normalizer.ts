/**
 * Lista canónica de materias/cargos conocidos para concursos docentes de Entre Ríos.
 * El orden importa: se usa el primer match.
 */
const CANONICAL_SUBJECTS: string[] = [
  // Lengua y Literatura
  "Lengua y Literatura",
  "Lengua",
  "Literatura Latinoamericana",
  "Literatura Argentina",
  "Didáctica de la Lengua y Literatura",
  // Matemática
  "Matemática",
  // Ciencias Sociales
  "Historia",
  "Geografía",
  "Formación Ética y Ciudadana",
  "Filosofía",
  "Sociología",
  "Psicología",
  "Derecho",
  "Economía",
  "Política y Ciudadanía",
  // Ciencias Naturales
  "Biología",
  "Física",
  "Química",
  "Ciencias Naturales",
  // Tecnología e Informática
  "Educación Tecnológica",
  "Tecnología",
  "Informática",
  // Idiomas
  "Inglés",
  "Francés",
  "Italiano",
  "Portugués",
  // Artística y Física
  "Educación Física",
  "Educación Artística",
  "Artes Plásticas",
  "Música",
  // Técnica / Agro
  "Instalaciones Electromecánicas",
  "Educación Agropecuaria",
  "Agroecología",
  "Contabilidad",
  "Administración",
  "Lógica",
  // Cargos directivos y de gestión
  "Dirección",
  "Vicedirección",
  "Secretaría",
  "Orientación Educativa",
  "Orientador Educacional",
  "Asesor Pedagógico",
  "Coordinación de Prácticas Profesionalizantes",
  "Preceptor",
  "Rector",
  "Bibliotecario",
  // Supervisión
  "Supervisor de Educación",
  "Supervisor de Jóvenes y Adultos",
  "Supervisor Escolar",
  // Formación docente
  "Práctica Docente",
  "Didáctica",
  // Genérico
  "Horas por Proyecto",
  "Espacios Curriculares",
  "Educación Especial",
  "Educación General",
  "Educación Inicial",
  "Nivel Inicial",
];

/**
 * Expande abreviaciones comunes que aparecen en avisos del CGE antes de normalizar.
 * Ej: "EDUC. TECNOLOGICA" → "Educación Tecnológica", "Ed. Fís." → "Educación Física"
 */
function expandAbbreviations(s: string): string {
  return s
    .replace(/\bEduc(?:aci[oó]n)?\.\s+Tecnol[oó]g?(?:ica)?\b/gi, "Educación Tecnológica")
    .replace(/\bEduc(?:aci[oó]n)?\.\s+F[ií]s(?:ica)?\b/gi, "Educación Física")
    .replace(/\bEduc(?:aci[oó]n)?\.\s+Art[ií]st?(?:ica)?\b/gi, "Educación Artística")
    .replace(/\bEduc(?:aci[oó]n)?\.\s+Agrop(?:ecuaria)?\b/gi, "Educación Agropecuaria")
    .replace(/\bEduc(?:aci[oó]n)?\.\s+Espec(?:ial)?\b/gi, "Educación Especial")
    .replace(/\bEduc(?:aci[oó]n)?\.\s+Ini(?:cial)?\b/gi, "Educación Inicial")
    .replace(/\bEd\.\s+F[ií]s(?:ica)?\b/gi, "Educación Física")
    .replace(/\bEd\.\s+Art[ií]st?(?:ica)?\b/gi, "Educación Artística")
    .replace(/\bEd\.\s+Tecnol[oó]g?(?:ica)?\b/gi, "Educación Tecnológica");
}

/** Normaliza tildes y mayúsculas para comparación. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const normalizedCanonicals = CANONICAL_SUBJECTS.map((s) => ({
  canonical: s,
  normalized: normalize(s),
}));

// Versión ordenada de mayor a menor longitud para el paso de substring:
// evita que "Física" gane sobre "Educación Física" cuando ambas están contenidas.
const normalizedByLength = [...normalizedCanonicals].sort(
  (a, b) => b.normalized.length - a.normalized.length,
);

/**
 * Intenta mapear un nombre de materia extraído al canónico más cercano.
 * - Primero expande abreviaciones (ej. "Educ. Tecnol." → "Educación Tecnológica").
 * - Luego busca match exacto (case/accent-insensitive).
 * - Luego busca si el texto extraído contiene algún canónico como substring.
 * - Si no hay match, devuelve undefined (el caller puede usar "General").
 */
export function normalizeSubjectName(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const expanded = expandAbbreviations(raw);
  const n = normalize(expanded);

  // 1) Exact match
  const exact = normalizedCanonicals.find((c) => c.normalized === n);
  if (exact) return exact.canonical;

  // 2) El raw contiene el canónico como substring ("de Matemática" → "Matemática")
  //    Busca por longitud descendente para que "Educación Física" gane sobre "Física".
  const contained = normalizedByLength.find((c) => n.includes(c.normalized));
  if (contained) return contained.canonical;

  // 3) El canónico contiene el raw como substring ("Lengua" matchea "Lengua y Literatura" parcial)
  //    Solo si el raw tiene al menos 4 chars para evitar falsos positivos.
  if (n.length >= 4) {
    const reverse = normalizedCanonicals.find((c) => c.normalized.includes(n));
    if (reverse) return reverse.canonical;
  }

  return undefined;
}

const CARGO_NAMES = new Set([
  "Preceptor",
  "Rector",
  "Bibliotecario",
  "Secretaría",
  "Dirección",
  "Vicedirección",
  "Orientación Educativa",
  "Orientador Educacional",
  "Asesor Pedagógico",
  "Coordinación de Prácticas Profesionalizantes",
  "Supervisor de Educación",
  "Supervisor de Jóvenes y Adultos",
  "Supervisor Escolar",
  "Maestra Domiciliaria Hospitalaria",
]);

export function getItemType(subjectName: string): "cargo" | "materia" {
  return CARGO_NAMES.has(subjectName) ? "cargo" : "materia";
}

export { CANONICAL_SUBJECTS };

/**
 * Mapa de overrides exactos: nombre específico → nombre del grupo.
 * Usado para agrupar variantes de la misma materia bajo un nombre canónico.
 */
const EXACT_GROUP_OVERRIDES: Record<string, string> = {
  // ── Lengua y Literatura ──────────────────────────────────────────────────
  "Lengua": "Lengua y Literatura",
  "Didáctica de la Lengua y Literatura": "Lengua y Literatura",

  // ── Literatura (variantes específicas) ───────────────────────────────────
  "Literatura Argentina":        "Literatura",
  "Literatura Latinoamericana":  "Literatura",
  "Literatura Universal":        "Literatura",
  "Literatura Clásica":          "Literatura",
  "Literatura Contemporánea":    "Literatura",
  "Literatura Moderna":          "Literatura",

  // ── Tecnología ───────────────────────────────────────────────────────────
  "Educación Tecnológica":       "Tecnología",
  "Dibujo Técnico":              "Tecnología",
  "Electrotecnia I":             "Tecnología",
  "Máquinas y Herramientas":     "Tecnología",
  "Instalaciones Electromecánicas": "Tecnología",

  // ── Arte ─────────────────────────────────────────────────────────────────
  "Educación Artística":         "Arte",
  "Artes Plásticas":             "Arte",
  "Cultura y Estética Contemporánea": "Arte",

  // ── Música ───────────────────────────────────────────────────────────────
  "Instrumento III - Corno":     "Música",
  "Prácticas Gimnásticas y Expresivas II": "Educación Física",

  // ── Idiomas ──────────────────────────────────────────────────────────────
  "IDIOMA EXTRANJERO":           "Idiomas",

  // ── Educación Agropecuaria ───────────────────────────────────────────────
  "Organización y Gestión de Empresas Agropecuarias": "Educación Agropecuaria",
  "PRODUCCIÓN DE BOVINOS PARA CARNE":                 "Educación Agropecuaria",
  "Agroecología":                "Educación Agropecuaria",
  "Educación Rural":             "Educación Agropecuaria",

  // ── Informática / Digital ────────────────────────────────────────────────
  "Producción Multimedia y Digital": "Informática",

  // ── Supervisión ──────────────────────────────────────────────────────────
  "Supervisor de Educación":          "Supervisión",
  "Supervisor Escolar":               "Supervisión",
  "Supervisor de Jóvenes y Adultos":  "Supervisión",

  // ── Tutoría ──────────────────────────────────────────────────────────────
  "Tutoría Docente":                             "Tutoría",
  "Tutorías":                                    "Tutoría",
  "Tutoría para la inclusión - IDÓNEO":          "Tutoría",
  "Tutoría para la inclusión – IDÓNEO":          "Tutoría",
  "Tutoría para la inclusión - IDÉNEO": "Tutoría",
  "Tutoría para la inclusión – IDÉNEO": "Tutoría",
  "TUTOR/A DE CIENCIAS SOCIALES":               "Tutoría",
  "Tutor/a Educativo/a Departamental de Jóvenes y Adultos": "Tutoría",

  // ── Tutoría Domiciliaria ─────────────────────────────────────────────────
  "Tutor Domiciliario":             "Tutoría Domiciliaria",
  "Tutor Domiciliario Hospitalario":"Tutoría Domiciliaria",
  "TUTOR DOMICILIARIO PARA":        "Tutoría Domiciliaria",
  "Profesor Tutor Domiciliario":    "Tutoría Domiciliaria",

  // ── Docencia primaria ────────────────────────────────────────────────────
  "Maestra de Ciclo":                                        "Maestra/o de Ciclo",
  "Maestro de Ciclo":                                        "Maestra/o de Ciclo",
  "Maestra de Grado Jornada Simple Escuela Primaria NEP N.°": "Maestra/o de Grado",
  "Maestro de Apoyo Ulramontano":    "Maestro de Apoyo",
  "Maestro de Apoyo Unidocente (MAU)": "Maestro de Apoyo",

  // ── Acompañamiento ───────────────────────────────────────────────────────
  "Acompañamiento al estudio de CS SOCIALES":               "Acompañamiento",
  "Acompañamiento al estudio de CS SOCIALES. (DESCONVOCADO)": "Acompañamiento",

  // ── Administración / Gestión ─────────────────────────────────────────────
  "Teoría y Gestión de las Organizaciones II": "Administración",

  // ── Comunicación ─────────────────────────────────────────────────────────
  "Cultura y Comunicación":             "Comunicación",
  "Teoría de la Comunicación I y II":   "Comunicación",

  // ── Salud / Enfermería ────────────────────────────────────────────────────
  "Salud":                       "Salud",
  "Metodología de la Investigación": "Investigación",
};

/**
 * Devuelve el nombre de grupo (normalized_name) para una materia.
 * Primero busca overrides exactos, luego aplica patrones, finalmente devuelve el nombre original.
 */
export function getSubjectGroupName(name: string): string {
  if (!name) return name;

  // 1. Override exacto
  if (EXACT_GROUP_OVERRIDES[name]) return EXACT_GROUP_OVERRIDES[name];

  // 2. Patrones genéricos (cubre variantes futuras)
  if (/^Literatura\s+\S/i.test(name))               return "Literatura";
  if (/^Tutorí?as?\b/i.test(name))                  return "Tutoría";
  if (/^Tutor\s+Domiciliario/i.test(name))           return "Tutoría Domiciliaria";
  if (/^Supervisor\s+(?:de|Escolar)/i.test(name))    return "Supervisión";
  if (/^Maestr[ao]\s+de\s+Ciclo/i.test(name))        return "Maestra/o de Ciclo";
  if (/^Maestr[ao]\s+de\s+Grado/i.test(name))        return "Maestra/o de Grado";
  if (/^Maestr[ao]\s+de\s+Apoyo/i.test(name))        return "Maestro de Apoyo";
  if (/^Acompa[nñ]amiento\b/i.test(name))            return "Acompañamiento";

  // 3. Sin grupo → normalized_name es el mismo que name
  return name;
}
