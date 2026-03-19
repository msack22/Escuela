import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeDepartmentName(raw: string | null | undefined): { name: string; slug: string } {
  const base = (raw ?? "").trim() || "Sin departamento";
  const canonicalName = base
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  const slug = canonicalName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");

  return { name: canonicalName, slug };
}

async function main() {
  console.log(">>> Migración de departamentos: inicio");

  const schools = await prisma.school.findMany({
    select: { id: true, department: true, department_id: true },
  });

  console.log(`Escuelas encontradas: ${schools.length}`);

  // Mapa de departamento normalizado -> Department.id
  const cache = new Map<string, number>();

  let departmentsCreated = 0;
  let schoolsUpdated = 0;

  for (const school of schools) {
    const { name, slug } = normalizeDepartmentName(school.department);
    const cacheKey = `${name}::${slug}`;

    let departmentId = cache.get(cacheKey);

    if (!departmentId) {
      // Buscar Department existente por slug o name
      const existing = await prisma.department.findFirst({
        where: { OR: [{ slug }, { name }] },
      });

      if (existing) {
        departmentId = existing.id;
      } else {
        const created = await prisma.department.create({
          data: { name, slug },
        });
        departmentId = created.id;
        departmentsCreated++;
        console.log(`  + Department creado: [${departmentId}] ${name} (${slug})`);
      }

      cache.set(cacheKey, departmentId);
    }

    // Actualizar escuela sólo si falta el department_id o el nombre no coincide con el canónico
    if (school.department_id !== departmentId || school.department !== name) {
      await prisma.school.update({
        where: { id: school.id },
        data: {
          department_id: departmentId,
          department: name,
        },
      });
      schoolsUpdated++;
    }
  }

  console.log(">>> Migración de departamentos finalizada.");
  console.log(`Departments creados: ${departmentsCreated}`);
  console.log(`Escuelas actualizadas: ${schoolsUpdated}`);
}

main()
  .catch((err) => {
    console.error("Error en migración de departamentos:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

