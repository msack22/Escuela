/**
 * AI-powered contest field extraction using Claude (Anthropic).
 *
 * This service is used as a fallback when the regex-based parser in
 * contest-text-parser.ts leaves critical fields empty (subjectName,
 * hoursToCover, contestDate). The AI runs on Anthropic's cloud servers —
 * the backend sends the raw contest text over HTTPS and receives structured
 * JSON back.
 *
 * Requires: ANTHROPIC_API_KEY env var.
 * If the key is missing or the call fails, the function returns {} so the
 * caller can continue with whatever the regex extracted.
 */

import Anthropic from "@anthropic-ai/sdk";
import { appLogger } from "../lib/logger.js";

export type AIContestFields = {
  subjectName?: string;
  hoursToCover?: number;
  shift?: string;
  level?: string;
  contestDate?: string; // ISO 8601 string, e.g. "2026-04-28T10:00:00"
  schedule?: string;
};

// Tool schema that forces Claude to respond with structured JSON
const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_contest_fields",
  description:
    "Extract structured fields from an Argentine educational contest (concurso docente) announcement. " +
    "Return only the fields you are confident about; omit fields you cannot determine.",
  input_schema: {
    type: "object" as const,
    properties: {
      subjectName: {
        type: "string",
        description:
          "Name of the subject or position (materia/cargo). E.g. 'Matemática', 'Física y Química', " +
          "'Maestra Domiciliaria Hospitalaria', 'Preceptor'. Capitalize properly. " +
          "Do NOT include year, division, shift, or hours.",
      },
      hoursToCover: {
        type: "number",
        description:
          "Total hours to cover (HC = Horas Cátedra, hs = horas). " +
          "Sum all HC/hs values mentioned. E.g. '4 HC' → 4, '2 HC + 3 HC' → 5.",
      },
      shift: {
        type: "string",
        enum: ["mañana", "tarde", "noche"],
        description: "Work shift: mañana, tarde, or noche.",
      },
      level: {
        type: "string",
        enum: ["secundario", "primario", "inicial", "superior", "supervisor"],
        description: "Education level of the contest.",
      },
      contestDate: {
        type: "string",
        description:
          "Contest date and time in ISO 8601 format (YYYY-MM-DDTHH:MM:SS). " +
          "E.g. 'lunes 28 de abril de 2026, a las 10 hs' → '2026-04-28T10:00:00'. " +
          "Only include if a specific date is mentioned.",
      },
      schedule: {
        type: "string",
        description:
          "Schedule information: days, hours, or time windows. E.g. 'Lunes a viernes 8:00 a 12:00 hs'. " +
          "Keep it concise.",
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

/**
 * Calls Claude to extract structured fields from a contest text.
 * Returns partial fields — only what the model is confident about.
 * Returns {} on error or if API key is not configured.
 */
export async function parseContestWithAI(text: string): Promise<AIContestFields> {
  const client = getClient();
  if (!client) {
    appLogger.debug("AI parser: ANTHROPIC_API_KEY not set, skipping");
    return {};
  }

  const prompt =
    "The following is the raw text of an Argentine educational contest announcement " +
    "(concurso docente). Extract the structured fields using the provided tool.\n\n" +
    "---\n" +
    text.slice(0, 3000) + // cap at 3k chars to stay well under token limit
    "\n---";

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_contest_fields" },
      messages: [{ role: "user", content: prompt }],
    });

    // Find the tool_use block in the response
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) {
      appLogger.warn("AI parser: no tool_use block in response");
      return {};
    }

    const raw = toolUse.input as Record<string, unknown>;

    // Validate and sanitize each field before returning
    const result: AIContestFields = {};

    if (typeof raw.subjectName === "string" && raw.subjectName.trim().length >= 3) {
      result.subjectName = raw.subjectName.trim().slice(0, 255);
    }
    if (typeof raw.hoursToCover === "number" && raw.hoursToCover > 0 && raw.hoursToCover <= 100) {
      result.hoursToCover = Math.round(raw.hoursToCover);
    }
    if (
      typeof raw.shift === "string" &&
      ["mañana", "tarde", "noche"].includes(raw.shift)
    ) {
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
    if (typeof raw.schedule === "string" && raw.schedule.trim().length > 0) {
      result.schedule = raw.schedule.trim().slice(0, 500);
    }

    appLogger.debug("AI parser: extracted fields", { result });
    return result;
  } catch (err) {
    appLogger.warn("AI parser: error calling Anthropic API", {
      error: (err as Error)?.message,
    });
    return {};
  }
}
