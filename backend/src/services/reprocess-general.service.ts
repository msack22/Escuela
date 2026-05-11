import { prisma } from "../db.js";
import { appLogger } from "../lib/logger.js";
import { parseContestWithAI } from "./ai-parser.service.js";
import { normalizeSubjectName, getItemType } from "../lib/subject-normalizer.js";

export type ReprocessResult = {
  total: number;
  updated: number;
  skipped: number;
};

/**
 * Re-procesa con IA todos los concursos cuya materia principal es "General".
 * Si la IA puede extraer materias específicas, actualiza contest.subject_id
 * y reemplaza los contestItems del concurso.
 */
export async function reprocessGeneralContests(): Promise<ReprocessResult> {
  const generalSubject = await prisma.subject.findFirst({ where: { name: "General" } });
  if (!generalSubject) {
    return { total: 0, updated: 0, skipped: 0 };
  }

  const contests = await prisma.contest.findMany({
    where: { subject_id: generalSubject.id },
    select: { id: true, title: true, description: true },
    orderBy: { created_at: "desc" },
    take: 300,
  });

  appLogger.info("Reprocess general: concursos encontrados", { count: contests.length });

  let updated = 0;
  let skipped = 0;

  for (const contest of contests) {
    const text = [contest.title, contest.description].filter(Boolean).join("\n\n");
    if (!text.trim()) {
      skipped++;
      continue;
    }

    const ai = await parseContestWithAI(text);
    const nonGeneral = (ai.items ?? []).filter(
      (item) => item.subjectName && item.subjectName.toLowerCase() !== "general",
    );

    if (nonGeneral.length === 0) {
      skipped++;
      continue;
    }

    const resolvedItems: {
      subjectName: string;
      subjectId: number;
      hoursToCover: number | null;
      itemType: string;
    }[] = [];

    for (const item of nonGeneral) {
      const subjectName = (normalizeSubjectName(item.subjectName) ?? item.subjectName ?? "General").slice(0, 255);
      let subject = await prisma.subject.findFirst({ where: { name: subjectName } });
      if (!subject) subject = await prisma.subject.create({ data: { name: subjectName } });
      resolvedItems.push({
        subjectName,
        subjectId: subject.id,
        hoursToCover: item.hoursToCover ?? null,
        itemType: getItemType(subjectName),
      });
    }

    const primary = resolvedItems[0];

    await prisma.$transaction(async (tx) => {
      await tx.contestItem.deleteMany({ where: { contest_id: contest.id } });
      await tx.contestItem.createMany({
        data: resolvedItems.map((ri) => ({
          contest_id: contest.id,
          subject_id: ri.subjectId,
          hours_to_cover: ri.hoursToCover,
          item_type: ri.itemType,
        })),
      });
      await tx.contest.update({
        where: { id: contest.id },
        data: {
          subject_id: primary.subjectId,
          hours_to_cover: primary.hoursToCover,
        },
      });
    });

    appLogger.info("Reprocess general: concurso actualizado", {
      contestId: contest.id,
      items: resolvedItems.map((ri) => `${ri.itemType}:${ri.subjectName}(${ri.hoursToCover ?? "?"}hs)`),
    });

    updated++;
    await new Promise((r) => setTimeout(r, 400));
  }

  appLogger.info("Reprocess general: finalizado", { total: contests.length, updated, skipped });
  return { total: contests.length, updated, skipped };
}
