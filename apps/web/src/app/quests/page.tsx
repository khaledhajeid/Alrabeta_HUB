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
      )}

      {visible.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">
            {tag ? `No published quests tagged "${tag}" yet.` : "No quests published yet."}
          </p>
        </div>
      ) : (
        // Phase 7.5.E: a browsable catalog reads as cards, not a bordered
        // row list — the row template that used to be reused for every
        // content type on this site regardless of shape. Title promoted to
        // text-base font-semibold so it actually anchors the card instead
        // of sitting in the same 12–14px band as its own metadata.
        <div className="reveal-list mt-6 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {visible.map((quest) => (
            <Link
              key={quest.id}
              href={`/quests/${quest.slug}`}
              className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-resting transition-[box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:-translate-y-0.5 hover:shadow-raised"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base leading-snug font-semibold text-text">{quest.title}</h2>
                <span className="shrink-0 font-mono text-xs text-text-muted">{quest.points} pts</span>
              </div>
              <p className="line-clamp-2 text-sm text-text-muted">{quest.summary}</p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                <span className="font-mono text-xs text-text-muted">{quest.difficulty}</span>
                {quest.tags.map((t) => (
                  <TagPill key={t} tag={t} />
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
