import { and, desc, eq, notInArray } from "drizzle-orm";
import { db } from "./db";
import { paths, tracks, quests, questSubmissions } from "./schema";
import type { trackIcon, questDifficulty } from "./schema";
import { sumPassedQuestPoints } from "./points";

export type ActiveTrack = {
  pathSlug: string;
  pathTitle: string;
  trackSlug: string;
  trackTitle: string;
  icon: (typeof trackIcon.enumValues)[number];
  passedCount: number;
  totalCount: number;
  isComplete: boolean;
};

export type ContinueCard = {
  pathSlug: string;
  pathTitle: string;
  trackSlug: string;
  trackTitle: string;
  questSlug: string;
  questTitle: string;
};

export type StandaloneQuest = {
  slug: string;
  title: string;
  summary: string;
  difficulty: (typeof questDifficulty.enumValues)[number];
  points: number;
};

export type DashboardData = {
  pointsEarned: number;
  activeTracks: ActiveTrack[];
  continueCard: ContinueCard | null;
  standaloneQuests: StandaloneQuest[];
};

// One call, one shape — the signed-in home dashboard needs all four of
// these together and none of them makes sense computed in isolation (a
// "continue" target has to be picked from the same active-track set the
// progress module renders). Phase 8.5: the home dashboard's whole reason
// for existing is surfacing real progress, not inventing it — every field
// here traces back to an actual questSubmissions row, nothing is a stand-in
// for Phase 9's not-yet-built points/rank system.
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const publishedTracks = await db.query.tracks.findMany({
    where: eq(tracks.status, "published"),
    orderBy: (t, { asc }) => [asc(t.orderIndex)],
    with: {
      path: true,
      trackQuests: {
        orderBy: (tq, { asc }) => [asc(tq.orderIndex)],
        with: { quest: true },
      },
    },
  });

  const trackedQuestIds = new Set(
    publishedTracks.flatMap((t) => t.trackQuests.map((tq) => tq.quest.id)),
  );

  const [submissions, standalonePublished] = await Promise.all([
    db.query.questSubmissions.findMany({
      where: eq(questSubmissions.userId, userId),
      orderBy: desc(questSubmissions.submittedAt),
      columns: { questId: true, status: true, submittedAt: true },
      with: { quest: { columns: { points: true, status: true } } },
    }),
    trackedQuestIds.size > 0
      ? db.query.quests.findMany({
          where: and(eq(quests.status, "published"), notInArray(quests.id, [...trackedQuestIds])),
          orderBy: desc(quests.createdAt),
          limit: 6,
        })
      : db.query.quests.findMany({
          where: eq(quests.status, "published"),
          orderBy: desc(quests.createdAt),
          limit: 6,
        }),
  ]);

  // Filtered once — passedQuestIds (activeTracks/continueCard) and
  // pointsEarned (via the shared sumPassedQuestPoints, also used by
  // leaderboard.ts so the two totals can't drift apart) both derive from
  // this same "is this submission a pass" pass instead of re-deriving it
  // independently.
  const passedSubmissions = submissions.filter((s) => s.status === "passed");
  const passedQuestIds = new Set(passedSubmissions.map((s) => s.questId));
  // submissions is already ordered newest-first, so the first hit per
  // questId is that quest's most recent submission time.
  const lastTouchedAt = new Map<string, Date>();
  for (const s of submissions) {
    if (!lastTouchedAt.has(s.questId)) lastTouchedAt.set(s.questId, s.submittedAt);
  }

  const pointsEarned = sumPassedQuestPoints(passedSubmissions);

  const activeTracks: ActiveTrack[] = [];
  let continueCard: ContinueCard | null = null;
  let continueCardTouchedAt = -Infinity;

  for (const track of publishedTracks) {
    const questList = track.trackQuests.map((tq) => tq.quest);
    const touched = questList.filter((q) => lastTouchedAt.has(q.id));
    if (touched.length === 0) continue;

    const passedCount = questList.filter((q) => passedQuestIds.has(q.id)).length;
    const isComplete = questList.length > 0 && passedCount === questList.length;
    activeTracks.push({
      pathSlug: track.path.slug,
      pathTitle: track.path.title,
      trackSlug: track.slug,
      trackTitle: track.title,
      icon: track.icon,
      passedCount,
      totalCount: questList.length,
      isComplete,
    });

    if (isComplete) continue;
    const trackTouchedAt = Math.max(...touched.map((q) => lastTouchedAt.get(q.id)!.getTime()));
    if (trackTouchedAt > continueCardTouchedAt) {
      const nextQuest = questList.find((q) => !passedQuestIds.has(q.id));
      if (nextQuest) {
        continueCardTouchedAt = trackTouchedAt;
        continueCard = {
          pathSlug: track.path.slug,
          pathTitle: track.path.title,
          trackSlug: track.slug,
          trackTitle: track.title,
          questSlug: nextQuest.slug,
          questTitle: nextQuest.title,
        };
      }
    }
  }

  return {
    pointsEarned,
    activeTracks,
    continueCard,
    standaloneQuests: standalonePublished,
  };
}

export type PlatformStats = {
  pathCount: number;
  trackCount: number;
  questCount: number;
};

// Signed-out landing's "real numbers, not invented ones" per the design
// brief — aggregate counts of what's actually published today.
export async function getPlatformStats(): Promise<PlatformStats> {
  const [publishedPaths, publishedTracks, publishedQuests] = await Promise.all([
    db.query.paths.findMany({ where: eq(paths.status, "published"), columns: { id: true } }),
    db.query.tracks.findMany({ where: eq(tracks.status, "published"), columns: { id: true } }),
    db.query.quests.findMany({ where: eq(quests.status, "published"), columns: { id: true } }),
  ]);
  return {
    pathCount: publishedPaths.length,
    trackCount: publishedTracks.length,
    questCount: publishedQuests.length,
  };
}
