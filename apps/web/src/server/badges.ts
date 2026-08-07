import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { badges, questSubmissions, quests } from "./schema";
import type { JudgeVerdict } from "./judge";

// Violet-tier badges: named "Violet-tier" because they require the judge's
// overall verdict to be "violet" — tests passed AND every sanitizer clean —
// not just the one sanitizer the badge's own tag cares about. A
// "multithreading" quest whose solution never calls pthread_create still
// hits tsan.clean === true (skipped, trivially clean), which is why the
// tsan check below also requires !skipped: TSan reporting "clean" because
// it never ran is not the same claim as TSan reporting "clean" because it
// looked and found nothing.
const TAG_BADGE_MAP: Record<string, { slug: string; check: (v: JudgeVerdict) => boolean }> = {
  memory: { slug: "zero-leak", check: (v) => v.valgrind.clean },
  multithreading: { slug: "race-free", check: (v) => v.tsan.clean && !v.tsan.skipped },
};

// Same list gates whether quest-submissions.ts even enqueues a grading job
// in the first place — a quest tagged neither way has nothing for the
// sandbox judge to check, so there's no reason to run it.
export const GRADABLE_TAGS = Object.keys(TAG_BADGE_MAP);

async function isFirstSubmissionForQuest(questId: string, userId: string, submissionId: string) {
  const earliest = await db.query.questSubmissions.findFirst({
    where: and(eq(questSubmissions.questId, questId), eq(questSubmissions.userId, userId)),
    orderBy: asc(questSubmissions.submittedAt),
  });
  return earliest?.id === submissionId;
}

/**
 * Awards Violet-tier badges for a graded submission, idempotently — safe to
 * call more than once for the same submission (a retried grading job, for
 * example) since the (userId, slug) unique constraint on badges makes the
 * insert a no-op the second time. Only ever awards on a user's first-ever
 * submission to the quest, so retrying a solved quest for fun never earns
 * it twice under a different mechanism than the unique constraint already
 * covers.
 */
export async function awardBadgesIfEligible(params: {
  submissionId: string;
  questId: string;
  userId: string;
  verdict: JudgeVerdict;
}): Promise<string[]> {
  if (params.verdict.verdict !== "violet") return [];

  const quest = await db.query.quests.findFirst({ where: eq(quests.id, params.questId) });
  if (!quest) return [];

  const eligibleTags = quest.tags.filter((tag) => tag in TAG_BADGE_MAP);
  if (eligibleTags.length === 0) return [];

  const isFirstSubmission = await isFirstSubmissionForQuest(params.questId, params.userId, params.submissionId);
  if (!isFirstSubmission) return [];

  const awarded: string[] = [];
  for (const tag of eligibleTags) {
    const { slug, check } = TAG_BADGE_MAP[tag];
    if (!check(params.verdict)) continue;

    const [badge] = await db
      .insert(badges)
      .values({ userId: params.userId, slug, questSubmissionId: params.submissionId })
      .onConflictDoNothing()
      .returning();
    if (badge) awarded.push(slug);
  }

  return awarded;
}
