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
        <div className="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {allRepos.map((repo) => (
            <Link
              key={repo.id}
              href={`/repos/${repo.ownerLogin}/${repo.name}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-surface-2"
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-text">
                  <span className="font-mono">{repo.fullName}</span>
                  {repo.private && (
                    <span className="rounded-full border border-line px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                      private
                    </span>
                  )}
                </div>
                {repo.description && (
                  <div className="mt-0.5 text-sm text-text-muted">{repo.description}</div>
                )}
              </div>
              <span className="font-mono text-xs text-text-muted">{repo.defaultBranch}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
