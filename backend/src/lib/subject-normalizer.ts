/**
 * Lista canónica de materias/cargos conocidos para concursos docentes de Entre Ríos.
 * El orden importa: se usa el primer match.
 */
const CANONICAL_SUBJECTS: string[] = [
  // Lengua y Literatura
  "Lengua y Literatura",
  "Lengua",
  "Literatura Latinoamericana",
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

/** Normaliza tildes y mayúsculas para comparación. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const normalizedCanonicals = CANONICAL_SUBJECTS.map((s) => ({
  canonical: s,
  normalized: normalize(s),
}));

/**
 * Intenta mapear un nombre de materia extraído al canónico más cercano.
 * - Primero busca match exacto (case/accent-insensitive).
 * - Luego busca si el texto extraído contiene algún canónico como substring.
 * - Si no hay match, devuelve undefined (el caller puede usar "General").
 */
export function normalizeSubjectName(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const n = normalize(raw);

  // 1) Exact match
  const exact = normalizedCanonicals.find((c) => c.normalized === n);
  if (exact) return exact.canonical;

  // 2) El raw contiene el canónico como substring ("de Matemática" → "Matemática")
  const contained = normalizedCanonicals.find((c) => n.includes(c.normalized));
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
