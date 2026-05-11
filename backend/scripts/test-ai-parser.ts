/**
 * Script de prueba para el AI parser.
 * Ejecutar: npx tsx scripts/test-ai-parser.ts
 */
import "dotenv/config";
import { parseContestWithAI } from "../src/services/ai-parser.service.js";

const sampleTexts = [
  {
    label: "Texto con HC y materia clara",
    text: `CONCURSO NIVEL SECUNDARIO - ESCUELA N° 123 VILLA PARANACITO
4 HC FISICA Y QUIMICA – 2° 2° – STF – T. TARDE
Fecha: lunes 28 de abril de 2026, a las 10 hs.
Lugar: Dirección Departamental de Escuelas Islas del Ibicuy`,
  },
  {
    label: "Texto con Unidad Curricular y turno mañana",
    text: `CONCURSO DOCENTE - NIVEL SECUNDARIO
Unidad Curricular: Matemática
04 hs - STF - Turno Mañana
Fecha de concurso: miércoles 15 de mayo de 2026 a las 08:00 hs
Departamento Gualeguaychú`,
  },
  {
    label: "Texto ambiguo sin estructura clara",
    text: `Se convoca a concurso de oposición y antecedentes para cubrir cargo vacante
en institución de nivel primario del departamento Uruguay.
Presentarse el día 20/05/2026 a las 9 horas en la sede de la DDE Uruguay.
Se trata de una maestra de grado turno tarde, 20 horas semanales.`,
  },
];

async function main() {
  console.log("=== Test AI Parser ===\n");

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("ERROR: ANTHROPIC_API_KEY no está configurada en .env");
    process.exit(1);
  }
  console.log(`API Key: ${key.slice(0, 15)}...\n`);

  for (const sample of sampleTexts) {
    console.log(`--- ${sample.label} ---`);
    console.log("Texto input:");
    console.log(sample.text);
    console.log("\nResultado AI:");

    const start = Date.now();
    const result = await parseContestWithAI(sample.text);
    const elapsed = Date.now() - start;

    console.log(JSON.stringify(result, null, 2));
    console.log(`Tiempo: ${elapsed}ms\n`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
