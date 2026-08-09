import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { tracks, questSubmissions } from "@/server/schema";
import { TagPill } from "@/components/tag-pill";
import { QuestStyleBadge } from "@/components/quest-style-badge";
import { PathStepDot } from "@/components/path-step-dot";

// Phase 8.5: the track detail screen — the existing Phase 8 stepper
// (path-step-dot.tsx), now against a real single-skill sequence instead of
// the old flattened 12-item cross-track list. "Current step" logic is
// unchanged: gated on a real signed-in session, same Phase 8 critique fix.
export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ pathSlug: string; trackSlug: string }>;
}) {
  const { pathSlug, trackSlug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  const track = await db.query.tracks.findFirst({
    where: eq(tracks.slug, trackSlug),
    with: {
      path: true,
      trackQuests: {
        orderBy: (tq, { asc }) => [asc(tq.orderIndex)],
        with: { quest: true },
      },
    },
  });
  // Guards against a track slug resolving under the wrong path in the URL,
  // not just a missing track — the same slug should read as 404 there too.
  if (!track || track.path.slug !== pathSlug || track.path.status !== "published") {
    notFound();
  }

  const questIds = track.trackQuests.map((tq) => tq.quest.id);
  const passedQuestIds = new Set<string>(
    session && questIds.length > 0
      ? (
          await db.query.questSubmissions.findMany({
            where: and(
              eq(questSubmissions.userId, session.user.id),
              eq(questSubmissions.status, "passed"),
              inArray(questSubmissions.questId, questIds),
            ),
            columns: { questId: true },
          })
        ).map((s) => s.questId)
      : [],
  );
  const currentQuestId = session
    ? track.trackQuests.find((tq) => !passedQuestIds.has(tq.quest.id))?.quest.id
    : undefined;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
        <Link href="/paths" className="transition-colors hover:text-text">
          Paths
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/paths/${track.path.slug}`} className="transition-colors hover:text-text">
          {track.path.title}
        </Link>
      </div>
      <h1 className="mt-1 text-xl font-semibold text-text">{track.title}</h1>
      <p className="mt-1.5 max-w-[65ch] text-sm text-text-muted">{track.summary}</p>

      {track.trackQuests.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">No quests published in this track yet.</p>
        </div>
      ) : (
        <ol className="reveal-list mt-8 flex flex-col gap-2">
          {track.trackQuests.map(({ quest, orderIndex }, i) => (
            <li key={quest.id} className="flex items-stretch gap-3">
              <PathStepDot
                position={orderIndex + 1}
                difficulty={quest.difficulty}
                passed={passedQuestIds.has(quest.id)}
                current={currentQuestId === quest.id}
                isLast={i === track.trackQuests.length - 1}
              />
              <Link
                href={`/quests/${quest.slug}`}
                className="flex flex-1 items-center gap-4 rounded-lg bg-surface p-4 shadow-resting transition-[box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:-translate-y-0.5 hover:shadow-raised"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm leading-snug font-semibold text-text">{quest.title}</h3>
                    <span className="shrink-0 font-mono text-xs text-text-muted">
                      {quest.points} pts
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-text-muted">{quest.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-text-muted">{quest.difficulty}</span>
                    <QuestStyleBadge style={quest.style} />
                    {quest.tags.map((t) => (
                      <TagPill key={t} tag={t} />
                    ))}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
