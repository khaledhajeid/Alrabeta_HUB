import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { paths, quests } from "@/server/schema";
import { TagPill } from "@/components/tag-pill";
import { TagFilterSelect } from "@/components/tag-filter-select";

// Phase 7.5.G: past this many, the pill row itself becomes more complex
// than the content it filters — collapse to a select instead.
const MAX_INLINE_TAGS = 6;

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;

  // Phase 7 close-out (docs/MASTER_PLAN.md §3.5): a real Paths structure,
  // not just a tag pill. A path's own quests come back pre-ordered
  // (orderIndex, ascending) — that ordering IS the curated sequence, not
  // something this page re-derives.
  const [publishedPaths, allPublished] = await Promise.all([
    db.query.paths.findMany({
      where: eq(paths.status, "published"),
      with: {
        pathQuests: {
          orderBy: (pq, { asc }) => [asc(pq.orderIndex)],
          with: { quest: true },
        },
      },
    }),
    // Standalone-membership below is derived entirely from publishedPaths'
    // own pathQuests, so this query doesn't need its own join to path_quests.
    db.query.quests.findMany({
      where: eq(quests.status, "published"),
      orderBy: desc(quests.createdAt),
    }),
  ]);

  const allTags = [...new Set(allPublished.flatMap((q) => q.tags))].sort();
  const matchesTag = (t: string[]) => !tag || t.includes(tag);

  // Standalone = published but not a member of any published path — this
  // is derived from path membership, not a stored flag (§3.5: storing
  // "is this standalone" as its own column would be redundant, derivable
  // state).
  const pathQuestIds = new Set(
    publishedPaths.flatMap((p) => p.pathQuests.map((pq) => pq.questId)),
  );
  const standalone = allPublished.filter((q) => !pathQuestIds.has(q.id));

  const visiblePaths = publishedPaths
    .map((p) => ({ ...p, pathQuests: p.pathQuests.filter((pq) => matchesTag(pq.quest.tags)) }))
    .filter((p) => p.pathQuests.length > 0);
  const visibleStandalone = standalone.filter((q) => matchesTag(q.tags));

  const nothingVisible = visiblePaths.length === 0 && visibleStandalone.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-xl font-semibold text-text">Quests</h1>

      {allTags.length > 0 &&
        (allTags.length > MAX_INLINE_TAGS ? (
          <div className="mt-4">
            <TagFilterSelect tags={allTags} current={tag} />
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/quests"
              className={`flex min-h-11 items-center rounded-full border px-3 text-xs font-medium transition-[color,border-color,transform] duration-(--motion-fast) ease-(--ease-out-quint) active:scale-95 ${
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
                className={`flex min-h-11 items-center rounded-full border px-3 text-xs font-medium transition-[color,border-color,transform] duration-(--motion-fast) ease-(--ease-out-quint) active:scale-95 ${
                  tag === t ? "border-text text-text" : "border-line text-text-muted hover:text-text"
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
        ))}

      {nothingVisible ? (
        <div className="mt-6 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">
            {tag ? `No published quests tagged "${tag}" yet.` : "No quests published yet."}
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {visiblePaths.map((path) => (
            <section key={path.id}>
              <h2 className="text-base font-semibold text-text">{path.title}</h2>
              <p className="mt-1 text-sm text-text-muted">{path.summary}</p>
              <ol className="reveal-list mt-4 flex flex-col gap-2">
                {path.pathQuests.map(({ quest, orderIndex }) => (
                  <li key={quest.id}>
                    <Link
                      href={`/quests/${quest.slug}`}
                      className="flex items-center gap-4 rounded-lg bg-surface p-4 shadow-resting transition-[box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:-translate-y-0.5 hover:shadow-raised"
                    >
                      <span className="w-6 shrink-0 text-right font-mono text-xs text-text-muted">
                        {orderIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm leading-snug font-semibold text-text">{quest.title}</h3>
                          <span className="shrink-0 font-mono text-xs text-text-muted">
                            {quest.points} pts
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-sm text-text-muted">{quest.summary}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-text-muted">
                            {quest.difficulty} · {quest.style}
                          </span>
                          {quest.tags.map((t) => (
                            <TagPill key={t} tag={t} />
                          ))}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          {visibleStandalone.length > 0 && (
            <section>
              {visiblePaths.length > 0 && (
                <h2 className="text-base font-semibold text-text">Standalone</h2>
              )}
              {/* Phase 7.5.E card-grid pattern — a browsable, unordered
                  catalog reads as cards, unlike a path's curated sequence
                  above, which reads as an ordered list on purpose. */}
              <div className="reveal-list mt-4 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                {visibleStandalone.map((quest) => (
                  <Link
                    key={quest.id}
                    href={`/quests/${quest.slug}`}
                    className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-resting transition-[box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:-translate-y-0.5 hover:shadow-raised"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base leading-snug font-semibold text-text">{quest.title}</h3>
                      <span className="shrink-0 font-mono text-xs text-text-muted">{quest.points} pts</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-text-muted">{quest.summary}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                      <span className="font-mono text-xs text-text-muted">
                        {quest.difficulty} · {quest.style}
                      </span>
                      {quest.tags.map((t) => (
                        <TagPill key={t} tag={t} />
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
