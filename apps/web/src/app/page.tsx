import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getDashboardData, getPlatformStats, type DashboardData, type PlatformStats } from "@/server/dashboard";
import { getRecentActivity, type ActivityEvent } from "@/server/activity";
import { TrackIcon } from "@/components/track-icon";
import { SignInCta } from "@/components/sign-in-cta";

// Phase 8.5: home used to be a bare copy of the live activity feed
// regardless of who was looking at it — no personalization, and a
// stranger landed on the same raw internal push log a signed-in user did.
// Two real states now: signed-in gets a progress dashboard (this project's
// own data, nothing borrowed from Phase 9's not-yet-built points/rank
// system), signed-out gets the platform's actual pitch. The live feed
// itself moved to /activity — it's cross-user platform state, not
// personal progress, and doesn't belong on either version of this page.
export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    const stats = await getPlatformStats();
    return <SignedOutLanding stats={stats} />;
  }

  const [data, recent] = await Promise.all([
    getDashboardData(session.user.id),
    getRecentActivity(3),
  ]);

  return <SignedInDashboard name={session.user.name} data={data} recent={recent} />;
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SignedInDashboard({
  name,
  data,
  recent,
}: {
  name: string;
  data: DashboardData;
  recent: ActivityEvent[];
}) {
  const firstName = name.split(" ")[0];
  const hasStarted = data.activeTracks.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-xl font-semibold text-text">Welcome back, {firstName}</h1>

      {!hasStarted ? (
        <div className="mt-6 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">
            You haven&rsquo;t started a track yet. Pick one to get going.
          </p>
          <Link
            href="/paths"
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-accent-ink transition-[background-color,box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:bg-accent hover:shadow-raised active:scale-95"
          >
            Browse Paths
          </Link>
        </div>
      ) : (
        <>
          {data.continueCard && (
            <Link
              href={`/quests/${data.continueCard.questSlug}`}
              className="mt-6 flex flex-col gap-1.5 rounded-lg bg-surface p-6 shadow-resting transition-[box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:-translate-y-0.5 hover:shadow-raised"
            >
              <span className="text-xs font-medium text-accent">Continue</span>
              <h2 className="text-lg leading-snug font-semibold text-text">
                {data.continueCard.questTitle}
              </h2>
              <span className="font-mono text-xs text-text-muted">
                {data.continueCard.pathTitle} · {data.continueCard.trackTitle}
              </span>
            </Link>
          )}

          <div className="mt-10 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-text">Your tracks</h2>
            {/* Phase 8.5 critique fix: the dual-agent review caught this
                number with nowhere to go and nothing explaining it — a
                real gap, not a rank/leaderboard system to build (that's
                Phase 9's). A native title tooltip is the honest-sized fix:
                it explains the number without linking to /profile, whose
                own placeholder currently disclaims points as not-yet-built
                and would contradict a real figure shown here. */}
            <span
              className="font-mono text-xs text-text-muted"
              title="Sum of points across every quest you've passed"
            >
              {data.pointsEarned} pts earned
            </span>
          </div>
          <div className="mt-4 divide-y divide-line rounded-lg bg-surface shadow-resting">
            {data.activeTracks.map((track) => (
              <Link
                key={track.trackSlug}
                href={`/paths/${track.pathSlug}/${track.trackSlug}`}
                className="flex items-center gap-4 p-4 transition-colors duration-(--motion-fast) ease-(--ease-out-quint) hover:bg-surface-2"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    track.isComplete ? "bg-signal text-signal-ink" : "bg-accent/10 text-accent"
                  }`}
                >
                  <TrackIcon icon={track.icon} width="18" height="18" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-text">{track.trackTitle}</span>
                    <span
                      className={`shrink-0 font-mono text-xs ${
                        track.isComplete ? "text-signal" : "text-text-muted"
                      }`}
                    >
                      {track.passedCount}/{track.totalCount}
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${track.isComplete ? "bg-signal" : "bg-accent"}`}
                      style={{ width: `${(track.passedCount / track.totalCount) * 100}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {data.standaloneQuests.length > 0 && (
        <>
          <div className="mt-10 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-text">Standalone quests</h2>
            <Link href="/quests" className="text-sm text-text-muted transition-colors hover:text-text">
              Browse all
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {data.standaloneQuests.map((quest) => (
              <Link
                key={quest.slug}
                href={`/quests/${quest.slug}`}
                className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-resting transition-[box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:-translate-y-0.5 hover:shadow-raised"
              >
                <span className="text-sm leading-snug font-medium text-text">{quest.title}</span>
                <span className="line-clamp-2 text-xs text-text-muted">{quest.summary}</span>
                <span className="mt-auto font-mono text-xs text-text-muted">
                  {quest.difficulty} · {quest.points} pts
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <div className="mt-10 border-t border-line pt-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-text">Recent activity</h2>
            <Link href="/activity" className="text-sm text-text-muted transition-colors hover:text-text">
              View all
            </Link>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {recent.map((event, i) => (
              <li key={`${event.at}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-text-muted">
                  <span className="font-medium text-text">{event.pusher}</span> pushed to{" "}
                  <span className="font-mono">{event.repo}@{event.branch}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-text-muted">{timeAgo(event.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SignedOutLanding({ stats }: { stats: PlatformStats }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-2xl leading-tight font-semibold text-balance text-text sm:text-3xl">
        Prove your backend skills against real, sandboxed execution.
      </h1>
      <p className="mt-4 max-w-[65ch] text-pretty text-text-muted">
        Alrabeta Hub grades what it claims to grade instead of diffing stdout — memory and
        thread safety verified with valgrind and sanitizers, Dockerfiles checked against the
        built image, git history inspected for real. Quests span Git, Bash/Linux, Docker, and
        C/C++ systems programming, built for developers who want proof, not a green checkmark.
      </p>

      <div className="mt-8">
        <SignInCta />
      </div>

      <p className="mt-6 font-mono text-xs text-text-muted">
        {stats.questCount} {stats.questCount === 1 ? "quest" : "quests"} · {stats.trackCount}{" "}
        {stats.trackCount === 1 ? "track" : "tracks"} · {stats.pathCount}{" "}
        {stats.pathCount === 1 ? "path" : "paths"} published
      </p>
    </div>
  );
}
