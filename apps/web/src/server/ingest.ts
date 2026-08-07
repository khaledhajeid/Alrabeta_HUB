import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { repos, repoRefs, commits } from "./schema";
import { fetchRecentCommits } from "./forgejo";
import { publishActivity } from "./activity";
import { notifyDiscord } from "./discord";
import { recordQuestSubmissionIfApplicable } from "./quest-submissions";

const ZERO_SHA = "0".repeat(40);

type RepoRow = typeof repos.$inferSelect;

type PushPayload = {
  ref: string;
  before: string;
  after: string;
  pusher: { login: string; id: number };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: { login: string };
    private: boolean;
    default_branch: string;
    html_url: string;
    description: string | null;
  };
  commits: Array<{
    id: string;
    message: string;
    author: { name: string; email: string; username?: string };
    timestamp: string;
    url: string;
  }>;
  head_commit: { message: string } | null;
};

async function upsertRepo(payload: PushPayload["repository"]): Promise<RepoRow> {
  const [repo] = await db
    .insert(repos)
    .values({
      forgejoId: payload.id,
      ownerLogin: payload.owner.login,
      name: payload.name,
      fullName: payload.full_name,
      description: payload.description,
      private: payload.private,
      defaultBranch: payload.default_branch,
      htmlUrl: payload.html_url,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: repos.forgejoId,
      set: {
        // Every field the payload carries, including ownerLogin — a repo
        // transferred to an org (like this one, just now) keeps the same
        // forgejoId but changes owner, and resyncRef builds its Forgejo API
        // path straight from ownerLogin + name. Missing it here silently
        // breaks resync for any repo that's ever been transferred, and
        // this exact bug produced exactly that stale state on first try.
        ownerLogin: payload.owner.login,
        name: payload.name,
        fullName: payload.full_name,
        description: payload.description,
        private: payload.private,
        defaultBranch: payload.default_branch,
        htmlUrl: payload.html_url,
        updatedAt: new Date(),
      },
    })
    .returning();
  return repo;
}

async function insertCommits(
  repoId: string,
  branch: string,
  rows: Array<{
    sha: string;
    message: string;
    authorName: string;
    authorEmail: string | null;
    authorUsername: string | null;
    authoredAt: Date;
    url: string;
  }>,
) {
  if (rows.length === 0) return;
  await db
    .insert(commits)
    .values(rows.map((c) => ({ repoId, branch, ...c })))
    .onConflictDoNothing();
}

// Shared tail for both ingestion paths (fast path and resync) — quest
// detection, then persist + fan out over SSE, then tell Discord, in that
// order, so a slow or failing Discord call (already non-throwing on its
// own) can never delay or block the feed actually reflecting the push.
//
// payload.after is the trustworthy new tip of the branch regardless of
// which path ran — the resync path exists because the *commit list* was
// uncertain, not because Forgejo's own report of the ref update was, so
// it's always correct to use here for "what commit is this submission."
async function finishPush(
  repo: RepoRow,
  branch: string,
  payload: PushPayload,
  commitCount: number,
) {
  await recordQuestSubmissionIfApplicable({
    branch,
    repoId: repo.id,
    commitSha: payload.after,
    pusherForgejoId: payload.pusher.id,
  });

  const persisted = await publishActivity({
    type: "push",
    repo: repo.fullName,
    branch,
    pusher: payload.pusher.login,
    commitCount,
    headMessage: payload.head_commit?.message ?? null,
  });
  await notifyDiscord(persisted);
}

async function advanceRef(repoId: string, ref: string, headSha: string) {
  await db
    .insert(repoRefs)
    .values({ repoId, ref, headSha })
    .onConflictDoUpdate({
      target: [repoRefs.repoId, repoRefs.ref],
      set: { headSha, updatedAt: new Date() },
    });
}

/**
 * Re-fetches a branch's commit history directly from the Forgejo API and
 * reconciles it, ignoring whatever we think we already know. This is the
 * recovery path: a dropped webhook and a force push both surface as "the
 * payload's `before` doesn't match our stored head," and both are fixed
 * the same way — ask Forgejo what's actually there. Also used directly by
 * the manual resync endpoint for repos that never got a webhook at all.
 */
export async function resyncRef(repo: Pick<RepoRow, "id" | "ownerLogin" | "name">, ref: string) {
  const branch = ref.replace(/^refs\/heads\//, "");
  const fetched = await fetchRecentCommits(repo.ownerLogin, repo.name, branch);

  await insertCommits(repo.id, branch, fetched);

  // Forgejo's commits API returns newest-first, so index 0 is the tip.
  const newHead = fetched[0]?.sha;
  if (newHead) await advanceRef(repo.id, ref, newHead);

  return { commitCount: fetched.length };
}

export async function ingestPush(payload: PushPayload) {
  if (payload.after === ZERO_SHA) {
    // Branch deletion. We only subscribe to "push" events, so Forgejo
    // shouldn't send this, but fail safe rather than insert garbage.
    return { skipped: "branch deleted" as const };
  }

  const repo = await upsertRepo(payload.repository);
  const branch = payload.ref.replace(/^refs\/heads\//, "");

  const existingRef = await db.query.repoRefs.findFirst({
    where: and(eq(repoRefs.repoId, repo.id), eq(repoRefs.ref, payload.ref)),
  });

  const isNewBranch = payload.before === ZERO_SHA;
  const cursorStale = !isNewBranch && existingRef?.headSha !== payload.before;

  // A matching cursor only proves we didn't miss a *prior* push — it says
  // nothing about whether Forgejo's commit-range computation for *this one*
  // is trustworthy. Non-fast-forward pushes are a known rough edge there:
  // verified empirically that a simple amend+force-push reports an accurate
  // list, but there's no guarantee that holds for an arbitrary rewrite. If
  // the payload doesn't even contain the commit it claims is now the tip,
  // it can't be trusted — resync instead of inserting a partial picture.
  const payloadOmitsNewTip = !isNewBranch && !payload.commits.some((c) => c.id === payload.after);

  const needsResync = cursorStale || payloadOmitsNewTip;

  if (needsResync) {
    const { commitCount } = await resyncRef(repo, payload.ref);
    await finishPush(repo, branch, payload, commitCount);
    return { repo, resynced: true, commitCount };
  }

  const commitRows = payload.commits.map((c) => ({
    sha: c.id,
    message: c.message,
    authorName: c.author.name,
    authorEmail: c.author.email,
    authorUsername: c.author.username ?? null,
    authoredAt: new Date(c.timestamp),
    url: c.url,
  }));

  await insertCommits(repo.id, branch, commitRows);
  await advanceRef(repo.id, payload.ref, payload.after);
  await finishPush(repo, branch, payload, commitRows.length);

  return { repo, resynced: false, commitCount: commitRows.length };
}
