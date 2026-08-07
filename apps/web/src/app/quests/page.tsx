import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { quests } from "@/server/schema";
import { TagPill } from "@/components/tag-pill";

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;

  const allPublished = await db.query.quests.findMany({
    where: eq(quests.status, "published"),
    orderBy: desc(quests.createdAt),
  });

  const allTags = [...new Set(allPublished.flatMap((q) => q.tags))].sort();
  const visible = tag ? allPublished.filter((q) => q.tags.includes(tag)) : allPublished;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-xl font-semibold text-text">Quests</h1>

      {allTags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/quests"
            className={`flex min-h-11 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
              !tag
                ? "border-text text-text"
                : "border-line text-text-muted hover:text-text"
            }`}
          >
            All
          </Link>
          {allTags.map((t) => (
            <Link
              key={t}
              href={`/quests?tag=${encodeURIComponent(t)}`}
              className={`flex min-h-11 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                tag === t ? "border-text text-text" : "border-line text-text-muted hover:text-text"
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">
            {tag ? `No published quests tagged "${tag}" yet.` : "No quests published yet."}
          </p>
        </div>
      ) : (
        <div className="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {visible.map((quest) => (
            <Link
              key={quest.id}
              href={`/quests/${quest.slug}`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-text">{quest.title}</span>
                  <span className="font-mono text-xs text-text-muted">{quest.difficulty}</span>
                  {quest.tags.map((t) => (
                    <TagPill key={t} tag={t} />
                  ))}
                </div>
                <p className="mt-1 truncate text-sm text-text-muted">{quest.summary}</p>
              </div>
              <span className="shrink-0 font-mono text-sm text-text-muted">
                {quest.points} pts
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
