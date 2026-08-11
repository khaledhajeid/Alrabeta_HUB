import type { questStatus } from "./schema";

export type PassedSubmission = {
  questId: string;
  quest: { points: number; status: (typeof questStatus.enumValues)[number] };
};

// Shared by dashboard.ts (one user's points) and leaderboard.ts (every
// user's points) so "what counts as points earned" can't quietly drift
// between the two surfaces — every passed submission against a currently
// published quest, deduped by questId (not submission row, since a
// regrade can leave more than one passing submission for the same quest).
// Callers pass only already-passed submissions; this doesn't re-check
// submission status itself, since dashboard.ts's caller needs that same
// "is this a pass" filter for other things (activeTracks, continueCard)
// and re-deriving it here would just be the second copy of that check.
export function sumPassedQuestPoints(passedSubmissions: PassedSubmission[]): number {
  const pointsByQuestId = new Map<string, number>();
  for (const s of passedSubmissions) {
    if (s.quest.status !== "published") continue;
    pointsByQuestId.set(s.questId, s.quest.points);
  }
  return [...pointsByQuestId.values()].reduce((sum, points) => sum + points, 0);
}
