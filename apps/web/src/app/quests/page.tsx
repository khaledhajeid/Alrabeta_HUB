import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { quests } from "@/server/schema";
import { TagPill } from "@/components/tag-pill";
import { TagFilterSelect } from "@/components/tag-filter-select";
import { QuestStyleBadge } from "@/components/quest-style-badge";

// Phase 7.5.G: past this many, the pill row itself becomes more complex
// than the content it filters — collapse to a select instead.
const MAX_INLINE_TAGS = 6;

// Phase 8.5: this page dropped its inline Paths section (docs/MASTER_PLAN.md's
// Phase 8.5 entry) — that's now its own dedicated hub at /paths (category ->
// track -> sequence). This page's job narrowed to exactly one thing: browse
// and filter every published quest, standalone or not, by tag. A learner
// looking for a curated curriculum goes to /paths; a learner who wants to
// search everything comes here.
export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;

  const [allPublished, trackMemberships] = await Promise.all([
    db.query.quests.findMany({
      where: eq(quests.status, "published"),
      orderBy: desc(quests.createdAt),
    }),
    // Phase 8.5 critique fix (P2): every published quest today happens to
    // belong to a track, which made this page and /paths look like
    // duplicate content with no stated relationship. Surfacing "part of
    // <track>" here makes the relationship visible instead of implicit,
    // and gives a way back into a track from search.
    db.query.trackQuests.findMany({
      with: { track: { with: { path: true } } },
    }),
  ]);
  const trackByQuestId = new Map(
    trackMemberships.map((tq) => [
      tq.questId,
      { trackTitle: tq.track.title, trackSlug: tq.track.slug, pathSlug: tq.track.path.slug },
    ]),
  );

  const allTags = [...new Set(allPublished.flatMap((q) => q.tags))].sort();
  const matchesTag = (t: string[]) => !tag || t.includes(tag);
  const visibleQuests = allPublished.filter((q) => matchesTag(q.tags));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-xl font-semibold text-text">Quests</h1>
      <p className="mt-1.5 text-sm text-text-muted">
        Every published quest, searchable by tag. Looking for a curated sequence instead?{" "}
        <Link href="/paths" className="text-accent hover:underline">
          Browse Paths
        </Link>
        .
      </p>

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

      {visibleQuests.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">
            {tag ? `No published quests tagged "${tag}" yet.` : "No quests published yet."}
          </p>
        </div>
      ) : (
        <div className="reveal-list mt-8 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {visibleQuests.map((quest) => {
            const membership = trackByQuestId.get(quest.id);
            return (
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
                {membership && (
                  <span className="font-mono text-xs text-text-muted">
                    Part of <span className="text-accent">{membership.trackTitle}</span>
                  </span>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  <span className="font-mono text-xs text-text-muted">{quest.difficulty}</span>
                  <QuestStyleBadge style={quest.style} />
                  {quest.tags.map((t) => (
                    <TagPill key={t} tag={t} />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
