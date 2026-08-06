import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { repos, commits } from "@/server/schema";
import { ResyncButton } from "@/components/resync-button";

function shortSha(sha: string) {
  return sha.slice(0, 8);
}

export default async function RepoDetailPage({
  params,
}: {
  params: Promise<{ owner: string; name: string }>;
}) {
  const { owner, name } = await params;

  const repo = await db.query.repos.findFirst({
    where: eq(repos.fullName, `${owner}/${name}`),
  });
  if (!repo) notFound();

  const commitLog = await db.query.commits.findMany({
    where: eq(commits.repoId, repo.id),
    orderBy: desc(commits.authoredAt),
    limit: 50,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-text">{repo.fullName}</h1>
            {repo.private && (
              <span className="rounded-full border border-line px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                private
              </span>
            )}
          </div>
          {repo.description && <p className="mt-1 text-sm text-text-muted">{repo.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ResyncButton owner={repo.ownerLogin} name={repo.name} />
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-text-muted underline decoration-line underline-offset-2 hover:text-text"
          >
            Open in Forgejo ↗
          </a>
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-medium text-text-muted">
        Commits{commitLog.length > 0 && ` (${commitLog.length})`}
      </h2>

      {commitLog.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">No commits ingested yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {commitLog.map((commit) => (
            <a
              key={commit.id}
              href={commit.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-start justify-between gap-4 px-5 py-3 hover:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-text">{commit.message.split("\n")[0]}</div>
                <div className="mt-0.5 font-mono text-xs text-text-muted">
                  {commit.authorUsername ?? commit.authorName}
                  {commit.branch !== repo.defaultBranch && ` · ${commit.branch}`}
                </div>
              </div>
              <span className="shrink-0 font-mono text-xs text-text-muted">
                {shortSha(commit.sha)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
