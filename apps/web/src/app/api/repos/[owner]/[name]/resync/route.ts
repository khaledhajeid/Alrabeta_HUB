import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { repos, repoRefs } from "@/server/schema";
import { resyncRef } from "@/server/ingest";

export const dynamic = "force-dynamic";

// Manual recovery for a repo that missed webhook coverage entirely (created
// before the webhook existed, or Forgejo's own retry window lapsed while the
// Hub was down) — reuses the exact same reconciliation path a detected
// dropped-webhook/force-push falls back to automatically.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ owner: string; name: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("unauthorized", { status: 401 });
  }

  const { owner, name } = await params;
  const repo = await db.query.repos.findFirst({
    where: eq(repos.fullName, `${owner}/${name}`),
  });
  if (!repo) {
    return new Response("repo not tracked yet — push to it at least once first", { status: 404 });
  }

  const refs = await db.query.repoRefs.findMany({ where: eq(repoRefs.repoId, repo.id) });
  const targets = refs.length > 0 ? refs.map((r) => r.ref) : [`refs/heads/${repo.defaultBranch}`];

  const results = await Promise.all(targets.map((ref) => resyncRef(repo, ref)));

  return Response.json({
    repo: repo.fullName,
    refs: targets,
    commitsIngested: results.reduce((sum, r) => sum + r.commitCount, 0),
  });
}
