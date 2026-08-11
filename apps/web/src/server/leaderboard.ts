import { eq } from "drizzle-orm";
import { db } from "./db";
import { questSubmissions } from "./schema";
import { sumPassedQuestPoints } from "./points";

export type LeaderboardEntry = {
  userId: string;
  name: string;
  image: string | null;
  points: number;
  rank: number;
};

export type LeaderboardData = {
  entries: LeaderboardEntry[];
  totalUsers: number;
};

// Ranks everyone's real total: every passed submission against a published
// quest, tracked or standalone. Points are computed via the same
// sumPassedQuestPoints() dashboard.ts uses, so the two surfaces can't drift
// apart on what "points earned" means — only the grouping differs (one
// user's submissions there, every user's here).
export async function getLeaderboard(): Promise<LeaderboardData> {
  const [allUsers, passedSubmissions] = await Promise.all([
    db.query.user.findMany({
      columns: { id: true, name: true, image: true, createdAt: true },
    }),
    db.query.questSubmissions.findMany({
      where: eq(questSubmissions.status, "passed"),
      columns: { userId: true, questId: true },
      with: { quest: { columns: { points: true, status: true } } },
    }),
  ]);

  const passedByUser = new Map<string, typeof passedSubmissions>();
  for (const sub of passedSubmissions) {
    let subs = passedByUser.get(sub.userId);
    if (!subs) {
      subs = [];
      passedByUser.set(sub.userId, subs);
    }
    subs.push(sub);
  }

  const ranked = allUsers
    .map((u) => {
      const subs = passedByUser.get(u.id);
      const points = subs ? sumPassedQuestPoints(subs) : 0;
      return { userId: u.id, name: u.name, image: u.image, points, createdAt: u.createdAt };
    })
    .sort((a, b) => b.points - a.points || a.createdAt.getTime() - b.createdAt.getTime());

  // Shared (competition-style) ranking: tied users show the same rank
  // number, and the next distinct point total picks up at its true
  // position rather than the next integer — misrepresenting a tie as an
  // ordering would be worse than the visual oddity of a skipped number.
  let rank = 0;
  let lastPoints = -1;
  const entries: LeaderboardEntry[] = ranked.map((u, i) => {
    if (u.points !== lastPoints) {
      rank = i + 1;
      lastPoints = u.points;
    }
    return { userId: u.userId, name: u.name, image: u.image, points: u.points, rank };
  });

  return { entries, totalUsers: entries.length };
}
