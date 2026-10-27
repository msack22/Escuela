/**
 * Pobla/actualiza el campo normalized_name de todos los subjects existentes.
 * Ejecutar con: npx tsx scripts/rebuild-normalized-names.ts
 */
import { PrismaClient } from "@prisma/client";
import { getSubjectGroupName } from "../src/lib/subject-normalizer.js";

const prisma = new PrismaClient();

async function main() {
  const subjects = await prisma.subject.findMany({ select: { id: true, name: true, normalized_name: true } });
  console.log(`Procesando ${subjects.length} subjects...`);

  let updated = 0;
  for (const s of subjects) {
    const normalized = getSubjectGroupName(s.name);
    if (normalized !== s.normalized_name) {
      await prisma.subject.update({ where: { id: s.id }, data: { normalized_name: normalized } });
      console.log(`  [${s.id}] "${s.name}" → "${normalized}"`);
      updated++;
    }
  }

  console.log(`\nActualizados: ${updated} / ${subjects.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
