import { count, eq, sum } from "drizzle-orm";
import { db } from "./db";
import { creditTransactions, questStatus } from "./schema";

export type CreditsData = {
  balance: number;
  hasEarned: boolean;
};

export async function getCredits(userId: string): Promise<CreditsData> {
  const [row] = await db
    .select({ total: sum(creditTransactions.amount), rows: count() })
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId));
  return { balance: Number(row?.total ?? 0), hasEarned: (row?.rows ?? 0) > 0 };
}

/**
 * Awards credits for a graded submission's first-ever pass on its quest,
 * idempotently — safe to call more than once for the same submission (a
 * retried grading job, for example) since the (userId, questId) unique
 * constraint on credit_transactions makes the insert a no-op the second
 * time. Amount is 1:1 with the quest's point value; once earned, credits
 * aren't clawed back if the quest is later unpublished (unlike the
 * leaderboard/dashboard points total, which is recomputed live and only
 * counts currently-published quests) — an already-earned balance is
 * history, not a live view.
 *
 * Takes the quest's points/status directly rather than re-querying by id —
 * every caller already has the quest row loaded for other reasons by the
 * time it's eligible to award credits.
 *
 * Returns the amount awarded, or null if nothing was awarded (not a pass,
 * quest not published, or already credited) — distinct from awarding a
 * real 0-point quest, which returns 0.
 */
export async function awardCreditsIfEligible(params: {
  questId: string;
  userId: string;
  status: "passed" | "failed";
  questPoints: number;
  questStatus: (typeof questStatus.enumValues)[number];
}): Promise<number | null> {
  if (params.status !== "passed" || params.questStatus !== "published") return null;

  const [row] = await db
    .insert(creditTransactions)
    .values({
      userId: params.userId,
      questId: params.questId,
      amount: params.questPoints,
      reason: "quest_passed",
    })
    .onConflictDoNothing()
    .returning();

  return row ? params.questPoints : null;
}
