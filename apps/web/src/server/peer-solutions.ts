import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "./db";
import { badges, commits, questSubmissions } from "./schema";

// Cap, not paginated — revisit if a quest's pass count ever actually
// approaches this at real scale. Not worth building pagination for today's
// numbers ahead of the need.
const PEER_LIST_LIMIT = 50;

export type PeerSolution = {
  userId: string;
  name: string;
  image: string | null;
  passedAt: Date;
  commitUrl: string | null;
  badgeSlugs: string[];
};

// One entry per peer (their first passing submission to this quest, not
// every resubmit), newest-first, capped, excluding the viewer themselves —
// "peer" means someone else. Gating on "has the viewer passed" happens at
// the call site (quest detail already has that from its own submissions
// query); this function assumes the caller already checked.
export async function getPeerSolutions(questId: string, viewerUserId: string): Promise<PeerSolution[]> {
  const passed = await db.query.questSubmissions.findMany({
    where: and(
      eq(questSubmissions.questId, questId),
      eq(questSubmissions.status, "passed"),
      ne(questSubmissions.userId, viewerUserId),
    ),
    orderBy: asc(questSubmissions.submittedAt),
    with: { user: { columns: { id: true, name: true, image: true } } },
  });

  const firstByUser = new Map<string, (typeof passed)[number]>();
  for (const s of passed) {
    if (!firstByUser.has(s.userId)) firstByUser.set(s.userId, s);
  }

  const entries = [...firstByUser.values()]
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
    .slice(0, PEER_LIST_LIMIT);

  if (entries.length === 0) return [];

  const repoIds = [...new Set(entries.map((e) => e.repoId))];
  const shas = entries.map((e) => e.commitSha);

  const [commitRows, badgeRows] = await Promise.all([
    db.query.commits.findMany({
      where: and(inArray(commits.repoId, repoIds), inArray(commits.sha, shas)),
    }),
    db.query.badges.findMany({
      where: inArray(
        badges.questSubmissionId,
        entries.map((e) => e.id),
      ),
    }),
  ]);

  // Keyed on repoId+sha together, not sha alone — the commits table's own
  // uniqueness is per-repo, so this is the correct match even though a sha
  // collision across two different repos is astronomically unlikely anyway.
  const commitUrlByKey = new Map(commitRows.map((c) => [`${c.repoId}:${c.sha}`, c.url]));

  const badgesBySubmission = new Map<string, string[]>();
  for (const b of badgeRows) {
    const existing = badgesBySubmission.get(b.questSubmissionId) ?? [];
    existing.push(b.slug);
    badgesBySubmission.set(b.questSubmissionId, existing);
  }

  return entries.map((e) => ({
    userId: e.userId,
    name: e.user.name,
    image: e.user.image,
    passedAt: e.submittedAt,
    commitUrl: commitUrlByKey.get(`${e.repoId}:${e.commitSha}`) ?? null,
    badgeSlugs: badgesBySubmission.get(e.id) ?? [],
  }));
}
