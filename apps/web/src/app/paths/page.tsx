import Link from "next/link";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { paths, tracks, questSubmissions } from "@/server/schema";
import { TrackIcon } from "@/components/track-icon";

// Phase 8.5: the dedicated curriculum entry point (docs/MASTER_PLAN.md's
// Phase 8.5 entry, decision 13) — replaces the inline path section /quests
// used to render. This page's one job is "does this feel like opening a
// curated curriculum," so it stays to large, few cards rather than a dense
// catalog grid; browsing everything (including standalone quests) is
// /quests' job, not this page's.
export default async function PathsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  const publishedPaths = await db.query.paths.findMany({
    where: eq(paths.status, "published"),
    with: {
      tracks: {
        where: eq(tracks.status, "published"),
        orderBy: (t, { asc }) => [asc(t.orderIndex)],
        with: {
          trackQuests: { with: { quest: { columns: { id: true } } } },
        },
      },
    },
  });

  const allQuestIds = publishedPaths.flatMap((p) =>
    p.tracks.flatMap((t) => t.trackQuests.map((tq) => tq.quest.id)),
  );

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
      <h1 className="text-xl font-semibold text-text">Paths</h1>
      <p className="mt-1.5 text-sm text-text-muted">
        Curated curricula, each one a sequence of single-skill tracks. Looking for something
        specific instead? <Link href="/quests" className="text-accent hover:underline">Browse all quests</Link>.
      </p>

      {publishedPaths.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">No paths published yet.</p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          {publishedPaths.map((path) => {
            const totalQuests = path.tracks.reduce((n, t) => n + t.trackQuests.length, 0);
            const passedCount = path.tracks.reduce(
              (n, t) => n + t.trackQuests.filter((tq) => passedQuestIds.has(tq.quest.id)).length,
              0,
            );
            return (
              <Link
                key={path.id}
                href={`/paths/${path.slug}`}
                className="group rounded-xl border border-line bg-surface p-8 shadow-resting transition-[box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:-translate-y-0.5 hover:shadow-raised"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-text">{path.title}</h2>
                  {session && totalQuests > 0 && (
                    <span className="shrink-0 font-mono text-xs text-text-muted">
                      {passedCount}/{totalQuests} solved
                    </span>
                  )}
                </div>
                <p className="mt-2 max-w-[65ch] text-sm text-text-muted">{path.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {path.tracks.map((track) => (
                    <span
                      key={track.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-mono text-xs text-text-muted transition-colors group-hover:border-accent/40 group-hover:text-text"
                    >
                      <TrackIcon icon={track.icon} width="13" height="13" />
                      {track.title}
                    </span>
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
