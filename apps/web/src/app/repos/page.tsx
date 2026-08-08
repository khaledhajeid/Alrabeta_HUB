import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/server/db";
import { repos } from "@/server/schema";

export default async function ReposPage() {
  const allRepos = await db.query.repos.findMany({ orderBy: desc(repos.updatedAt) });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-xl font-semibold text-text">Repos</h1>

      {allRepos.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">
            Nothing tracked yet — repos show up here the first time someone pushes with the
            Hub&rsquo;s webhook wired up.
          </p>
        </div>
      ) : (
        // Phase 7.5.E: cards here too, but a distinct shape from the quest
        // catalog (mono full-name as the title, description below, branch
        // as a trailing tag) — same browsable-catalog idea, differentiated
        // by what a repo actually is, not by reusing the quest card verbatim.
        <div className="reveal-list mt-6 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {allRepos.map((repo) => (
            <Link
              key={repo.id}
              href={`/repos/${repo.ownerLogin}/${repo.name}`}
              className="flex flex-col gap-2 rounded-lg bg-surface p-5 shadow-resting transition-[box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:-translate-y-0.5 hover:shadow-raised"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-base leading-snug font-semibold text-text">
                  {repo.fullName}
                </span>
                {repo.private && (
                  <span className="shrink-0 rounded-full border border-line px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                    private
                  </span>
                )}
              </div>
              {repo.description && (
                <p className="line-clamp-2 text-sm text-text-muted">{repo.description}</p>
              )}
              <span className="mt-auto pt-1 font-mono text-xs text-text-muted">
                {repo.defaultBranch}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
