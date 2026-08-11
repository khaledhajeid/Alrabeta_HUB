import { headers } from "next/headers";
import Image from "next/image";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { badges } from "@/server/schema";
import { BadgePill } from "@/components/badge-pill";
import { getStreak } from "@/server/streak";

// Same stroke-icon language as SparkIcon in badge-pill.tsx (2px stroke,
// rounded caps) — a flame, not an emoji, keeping the "quiet and confident"
// tone the badge system already committed to.
function FlameIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M12 2c-1.5 3-4 5-4 8.5a4 4 0 0 0 8 0c0-1-.3-2-1-3 1.5.5 3 2.5 3 5.5a6 6 0 0 1-12 0C6 8 9 5.5 12 2Z" />
    </svg>
  );
}

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-xl font-semibold text-text">Profile</h1>
        <div className="mt-6 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">
            Sign in with Forgejo (top right) to see this.
          </p>
        </div>
      </div>
    );
  }

  const { user } = session;
  const [earnedBadges, streak] = await Promise.all([
    db.query.badges.findMany({
      where: eq(badges.userId, user.id),
      orderBy: (b, { desc }) => desc(b.awardedAt),
    }),
    getStreak(user.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-xl font-semibold text-text">Profile</h1>

      <div className="mt-6 flex items-center gap-4 rounded-lg bg-surface p-5 shadow-resting">
        {user.image ? (
          <Image
            src={user.image}
            alt={`${user.name}'s avatar`}
            width={56}
            height={56}
            className="h-14 w-14 rounded-full"
          />
        ) : (
          <div className="h-14 w-14 rounded-full bg-surface-2" aria-hidden />
        )}
        <div>
          <div className="text-base font-medium text-text">{user.name}</div>
          <div className="text-sm text-text-muted">{user.email}</div>
        </div>
      </div>

      {/* Phase 7.5.F: the badge system existed conceptually since Phase 5
          (it's why --accent is violet) but rendered nowhere in the shipped
          product until now — this is "show what already exists," not new
          gamification mechanics. */}
      <div className="mt-4 rounded-lg bg-surface p-5 shadow-resting">
        <h2 className="text-sm font-medium text-text-muted">Badges</h2>
        {earnedBadges.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">
            None yet — solve a memory or multithreading quest clean (valgrind or
            ThreadSanitizer clear on the first try) to earn one.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {[...new Set(earnedBadges.map((b) => b.slug))].map((slug) => (
              <BadgePill key={slug} slug={slug} />
            ))}
          </div>
        )}
      </div>

      {/* Phase 9: fills the placeholder this card has held since 7.5.F.
          --ember was reserved for "streaks/warnings" from the day it was
          named (DESIGN.md) but never actually used in UI chrome until now —
          same "show what already exists" move as the badge card above. */}
      <div className="mt-4 rounded-lg bg-surface p-5 shadow-resting">
        <h2 className="text-sm font-medium text-text-muted">Streak</h2>
        {!streak.hasEverPassed ? (
          <p className="mt-2 text-sm text-text-muted">
            None yet — pass a quest to start your streak.
          </p>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <FlameIcon
              className={`h-8 w-8 shrink-0 ${streak.current > 0 ? "text-ember" : "text-text-muted"}`}
            />
            <div>
              <div className="font-mono text-base font-semibold tabular-nums text-text">
                {streak.current}-day streak
              </div>
              {streak.longest > streak.current && (
                <div className="text-xs text-text-muted">Best: {streak.longest} days</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
