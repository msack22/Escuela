/**
 * Script one-time: limpia la tabla de subjects, mergeando basura hacia canónicos.
 * Uso: npx tsx scripts/cleanup-subjects.ts
 */
import { PrismaClient } from "@prisma/client";
import { normalizeSubjectName } from "../src/lib/subject-normalizer.js";

const prisma = new PrismaClient();

async function main() {
  const subjects = await prisma.subject.findMany({ orderBy: { id: "asc" } });
  console.log(`Total subjects before cleanup: ${subjects.length}`);

  // Materias que son claramente basura y se mapean a "General"
  const FORCE_GENERAL = new Set([
    "áulicas",
    "Concurso General",
    "Convocatoria General",
    "Curso: 1er",
    "de Artes Visuales Multiaño",
    "de ascenso",
    "de los espacios curriculares de las Prácticas Profesionalizantes",
    "de Maestro de Educación Física",
    "de Matemática",
    "de Música 1er año",
    "de Taller de Idioma Extranjero: Ingles &#8211",
    "de una escuela en particular",
    "de Unidad de Definición institucional UDI (Taller)",
    "Didáctica de la Lengua y Literatura I (",
    "EDUACION TECNOLOGICA",
    "Espacios Curriculares",
    "Filosofía II",
    "Fisica 1er año ESA",
    "formación ética y ciudana &#8211",
    "La Fundación Bunge",
    "Los aspirantes deberán presentarse con DNI físico o digital a travé s de la Aplicación Mi Argentina",
    "MAESTRO",
    "Maestro de Ciclo JS S",
    "Orientador Educacional con Perfil Psicológico S",
    "Práctica Docente III – Formato: Seminario Taller – Perfil: Generalista &#8211",
    "Práctica Docente III (Generalista)- Formato: Seminario-taller",
    "\"Práctica Docente III: Equipo de cátedra\" 3er",
    "Referente",
    "Tecnología a",
    "TIC – multiaño &#8211",
    "y HORAS CÁTEDRAS en el Marco",
    "– Filosofía",
    "asesor pedagógico",
    "Capacitación Digital",
    "Capacitación Docente",
    "Trabajo Práctico",
  ]);

  // Asegurar que existe "General"
  let generalSubject = await prisma.subject.findFirst({ where: { name: "General" } });
  if (!generalSubject) {
    generalSubject = await prisma.subject.create({ data: { name: "General" } });
  }

  let merged = 0;
  let deleted = 0;

  for (const subject of subjects) {
    if (subject.name === "General") continue;

    // Determinar target canónico
    let targetName: string | null = null;

    if (FORCE_GENERAL.has(subject.name)) {
      targetName = "General";
    } else {
      targetName = normalizeSubjectName(subject.name) ?? null;
    }

    if (!targetName || targetName === subject.name) continue;

    // Buscar o crear el subject canónico
    let target = await prisma.subject.findFirst({ where: { name: targetName } });
    if (!target) {
      target = await prisma.subject.create({ data: { name: targetName } });
    }

    // Reasignar todos los concursos que apuntan a este subject
    const contestCount = await prisma.contest.count({ where: { subject_id: subject.id } });
    if (contestCount > 0) {
      await prisma.contest.updateMany({
        where: { subject_id: subject.id },
        data: { subject_id: target.id },
      });
      merged += contestCount;
    }

    // Eliminar el subject basura
    await prisma.subject.delete({ where: { id: subject.id } });
    deleted++;
    console.log(`  "${subject.name}" → "${targetName}" (${contestCount} contests reasignados)`);
  }

  const remaining = await prisma.subject.count();
  console.log(`\nDone: ${deleted} subjects eliminados, ${merged} concursos reasignados.`);
  console.log(`Subjects restantes: ${remaining}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
