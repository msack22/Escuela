import Anthropic from "@anthropic-ai/sdk";
import { appLogger } from "../lib/logger.js";
import { CANONICAL_SUBJECTS } from "../lib/subject-normalizer.js";

export type AIContestItem = {
  subjectName?: string;
  hoursToCover?: number;
};

export type AIContestFields = {
  items?: AIContestItem[];
  shift?: string;
  level?: string;
  contestDate?: string; // ISO 8601
  dateNotes?: string;
  schedule?: string;
};

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_contest_fields",
  description:
    "Extrae campos estructurados de un aviso de concurso docente argentino. " +
    "Devolvé solo los campos que podés determinar con seguridad.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        description:
          "Lista de materias/cargos del concurso, una por línea con sus horas. " +
          "Si el aviso menciona varias materias (ej: '2 HC MATEMÁTICA' y '3 HC FÍSICA'), " +
          "incluí una entrada por cada una. Si solo hay una materia, igualmente devolvé un array con un elemento.",
        items: {
          type: "object",
          properties: {
            subjectName: {
              type: "string",
              description:
                "Nombre de la materia o cargo. Usá el nombre canónico más cercano de la lista cuando coincida. " +
                "NO incluyas año, división, turno ni horas. Capitalizá correctamente.",
            },
            hoursToCover: {
              type: "number",
              description: "Horas a cubrir para esta materia (HC = Horas Cátedra, hs = horas).",
            },
          },
          required: ["subjectName"],
        },
      },
      shift: {
        type: "string",
        enum: ["mañana", "tarde", "noche"],
        description: "Turno principal del concurso.",
      },
      level: {
        type: "string",
        enum: ["secundario", "primario", "inicial", "superior", "supervisor"],
        description: "Nivel educativo del concurso.",
      },
      contestDate: {
        type: "string",
        description:
          "Fecha y hora del concurso en ISO 8601 (YYYY-MM-DDTHH:MM:SS). " +
          "Ej: 'lunes 28 de abril de 2026, a las 10 hs' → '2026-04-28T10:00:00'. " +
          "Solo incluir si hay una fecha específica en el texto.",
      },
      dateNotes: {
        type: "string",
        description:
          "Si encontraste contestDate: indicá la frase exacta del texto que usaste Y una expresión regular " +
          "JavaScript (sin delimitadores) que capturaría ese patrón para futuros casos. " +
          "Formato: 'TEXTO: «...frase...» | REGEX: ...patrón...'. " +
          "Si NO encontraste fecha futura: explicá brevemente por qué. " +
          "Ejemplos: " +
          "'TEXTO: «se realizará el martes 20 de mayo de 2026 a las 10 hs» | REGEX: se realizará el \\\\w+ (\\\\d{1,2}) de (\\\\w+) de (\\\\d{4}) a las (\\\\d{1,2}) hs' " +
          "o 'No hay fecha futura en el texto, solo menciona la fecha de publicación 15/04/2026.'",
      },
      schedule: {
        type: "string",
        description: "Información de horario: días, horas o ventanas de tiempo. Breve.",
      },
    },
    required: [],
  },
};

let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export async function parseContestWithAI(text: string): Promise<AIContestFields> {
  const client = getClient();
  if (!client) {
    appLogger.debug("AI parser: ANTHROPIC_API_KEY no configurado, omitiendo");
    return {};
  }

  const canonicalList = CANONICAL_SUBJECTS.join(", ");
  const prompt =
    "Sos un asistente que extrae información estructurada de concursos docentes argentinos.\n\n" +
    "Lista de materias/cargos canónicos (usá el más cercano de esta lista cuando sea posible):\n" +
    canonicalList + "\n\n" +
    "Un mismo aviso puede listar MÚLTIPLES materias con sus horas (ej: '2 HC MATEMÁTICA', '3 HC FÍSICA'). " +
    "Extraé cada una como un item separado en el array.\n\n" +
    "---\n" +
    text.slice(0, 3500) +
    "\n---";

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_contest_fields" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) {
      appLogger.warn("AI parser: no se encontró tool_use en la respuesta");
      return {};
    }

    const raw = toolUse.input as Record<string, unknown>;
    const result: AIContestFields = {};

    if (Array.isArray(raw.items) && raw.items.length > 0) {
      const validItems: AIContestItem[] = [];
      for (const item of raw.items) {
        if (typeof item !== "object" || !item) continue;
        const i = item as Record<string, unknown>;
        if (typeof i.subjectName === "string" && i.subjectName.trim().length >= 3) {
          const parsed: AIContestItem = { subjectName: i.subjectName.trim().slice(0, 255) };
          if (typeof i.hoursToCover === "number" && i.hoursToCover > 0 && i.hoursToCover <= 100) {
            parsed.hoursToCover = Math.round(i.hoursToCover);
          }
          validItems.push(parsed);
        }
      }
      if (validItems.length > 0) result.items = validItems;
    }

    if (typeof raw.shift === "string" && ["mañana", "tarde", "noche"].includes(raw.shift)) {
      result.shift = raw.shift;
    }
    if (
      typeof raw.level === "string" &&
      ["secundario", "primario", "inicial", "superior", "supervisor"].includes(raw.level)
    ) {
      result.level = raw.level;
    }
    if (typeof raw.contestDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw.contestDate)) {
      result.contestDate = raw.contestDate;
    }
    if (typeof raw.dateNotes === "string" && raw.dateNotes.trim().length > 0) {
      result.dateNotes = raw.dateNotes.trim().slice(0, 500);
    }
    if (typeof raw.schedule === "string" && raw.schedule.trim().length > 0) {
      result.schedule = raw.schedule.trim().slice(0, 500);
    }

    appLogger.debug("AI parser: campos extraídos", { itemCount: result.items?.length });
    return result;
  } catch (err) {
    appLogger.warn("AI parser: error llamando Anthropic API", { error: (err as Error)?.message });
    return {};
  }
}
