import { headers } from "next/headers";
import Image from "next/image";
import { auth } from "@/server/auth";
import { getLeaderboard } from "@/server/leaderboard";
import { FlairIcon } from "@/components/shop-icons";

// Phase 9: public like /activity, not gated like /profile — a leaderboard
// is inherently about seeing everyone, and /activity already set the
// precedent that cross-user platform state doesn't require sign-in on this
// still-invite-only platform. Session is only used to find and highlight
// "you" in the list, never to gate the page itself.
export default async function LeaderboardPage() {
  const [session, { entries, totalUsers }] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getLeaderboard(),
  ]);

  const currentUserId = session?.user.id ?? null;
  const currentEntry = currentUserId ? (entries.find((e) => e.userId === currentUserId) ?? null) : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text">Leaderboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          Ranked by real points earned across every published quest.
        </p>
      </div>

      {currentEntry && (
        <div className="mb-6 flex items-center justify-between rounded-lg bg-accent/10 px-5 py-3">
          <span className="text-sm font-medium text-accent">
            You&rsquo;re #{currentEntry.rank} of {totalUsers}
          </span>
          <span className="font-mono text-xs font-semibold tabular-nums text-accent">
            {currentEntry.points} pts
          </span>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">No one&rsquo;s on the board yet.</p>
        </div>
      ) : (
        <div className="reveal-list divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-resting">
          {entries.map((entry) => {
            const isYou = entry.userId === currentUserId;
            return (
              <div
                key={entry.userId}
                className={`flex items-center gap-4 px-5 py-3 transition-colors duration-(--motion-fast) ease-(--ease-out-quint) ${
                  isYou ? "bg-accent/10" : ""
                }`}
              >
                <span
                  className={`w-8 shrink-0 text-right font-mono text-sm tabular-nums ${
                    entry.rank <= 3 ? "font-semibold text-accent" : "text-text-muted"
                  }`}
                >
                  {entry.rank}
                </span>
                {entry.image ? (
                  <Image
                    src={entry.image}
                    alt={`${entry.name}'s avatar`}
                    width={32}
                    height={32}
                    className="h-8 w-8 shrink-0 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 shrink-0 rounded-full bg-surface-2" aria-hidden />
                )}
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium text-text">
                  {entry.flairGlyph && (
                    <FlairIcon glyph={entry.flairGlyph} className="h-3.5 w-3.5 shrink-0 text-accent" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  {entry.title && (
                    <span className="min-w-0 shrink truncate text-xs font-normal text-text-muted">
                      &middot; {entry.title}
                    </span>
                  )}
                  {isYou && <span className="shrink-0 text-xs font-normal text-accent">(you)</span>}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
                  {entry.points} pts
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
