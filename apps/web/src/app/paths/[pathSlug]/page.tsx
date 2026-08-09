import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { paths, tracks, questSubmissions } from "@/server/schema";
import { TrackIcon } from "@/components/track-icon";
import { uniformRunnerLabel } from "@/lib/runner-info";

// Phase 8.5: the track-browse tier (docs/MASTER_PLAN.md's Phase 8.5 entry).
// This is where the critique's "distinct, visually engaging tracks" ask
// actually lives — each track gets its own icon, quest count, difficulty
// range, and (signed in) progress, not a numbered row in a flat list.
export default async function PathTracksPage({
  params,
}: {
  params: Promise<{ pathSlug: string }>;
}) {
  const { pathSlug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  const path = await db.query.paths.findFirst({
    where: and(eq(paths.slug, pathSlug), eq(paths.status, "published")),
    with: {
      tracks: {
        where: eq(tracks.status, "published"),
        orderBy: (t, { asc }) => [asc(t.orderIndex)],
        with: {
          trackQuests: {
            orderBy: (tq, { asc }) => [asc(tq.orderIndex)],
            with: { quest: true },
          },
        },
      },
    },
  });
  if (!path) notFound();

  const allQuestIds = path.tracks.flatMap((t) => t.trackQuests.map((tq) => tq.quest.id));
  const passedQuestIds = new Set<string>(
    session && allQuestIds.length > 0
      ? (
          await db.query.questSubmissions.findMany({
            where: and(
              eq(questSubmissions.userId, session.user.id),
              eq(questSubmissions.status, "passed"),
              inArray(questSubmissions.questId, allQuestIds),
            ),
            columns: { questId: true },
          })
        ).map((s) => s.questId)
      : [],
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/paths"
        className="text-sm text-text-muted transition-colors hover:text-text"
      >
        Paths
      </Link>
      <h1 className="mt-1 text-xl font-semibold text-text">{path.title}</h1>
      <p className="mt-1.5 max-w-[65ch] text-sm text-text-muted">{path.summary}</p>

      {path.tracks.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">No tracks published in this path yet.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {path.tracks.map((track) => {
            const quests = track.trackQuests;
            const passedCount = quests.filter((tq) => passedQuestIds.has(tq.quest.id)).length;
            const isComplete = session && quests.length > 0 && passedCount === quests.length;
            const lowDifficulty = quests[0]?.quest.difficulty;
            const highDifficulty = quests[quests.length - 1]?.quest.difficulty;
            const runnerLabel = uniformRunnerLabel(quests.map((tq) => tq.quest.runner));

            return (
              <Link
                key={track.id}
                href={`/paths/${path.slug}/${track.slug}`}
                className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-resting transition-[box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:-translate-y-0.5 hover:shadow-raised"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isComplete ? "bg-signal text-signal-ink" : "bg-accent/10 text-accent"
                    }`}
                  >
                    <TrackIcon icon={track.icon} width="18" height="18" />
                  </span>
                  {session && quests.length > 0 && (
                    <span
                      className={`shrink-0 font-mono text-xs font-medium ${
                        isComplete ? "text-signal" : "text-text-muted"
                      }`}
                    >
                      {passedCount}/{quests.length}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-base leading-snug font-semibold text-text">{track.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-text-muted">{track.summary}</p>
                </div>
                {lowDifficulty && highDifficulty && (
                  <div className="mt-auto flex flex-col gap-1 pt-1">
                    <span className="font-mono text-xs text-text-muted">
                      {quests.length} {quests.length === 1 ? "quest" : "quests"} ·{" "}
                      {lowDifficulty === highDifficulty
                        ? lowDifficulty
                        : `${lowDifficulty} to ${highDifficulty}`}
                    </span>
                    {runnerLabel && (
                      <span className="font-mono text-xs text-accent">{runnerLabel}</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
