import { headers } from "next/headers";
import Image from "next/image";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { badges } from "@/server/schema";
import { BadgePill } from "@/components/badge-pill";
import { getStreak } from "@/server/streak";
import { getCredits } from "@/server/credits";

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

// Same stroke language again — a plain token (two concentric circles), not
// a coin-with-$-sign or a coin stack, keeping the "quiet and confident"
// register instead of a game-shop cliche.
function TokenIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}

// Shared by Badges/Streak/Credits below — three near-identical card shells
// (label header + either an empty-state line or custom content) were
// enough real duplication to be worth naming, unlike the per-card content
// itself (icon, color, copy), which stays inline since it genuinely
// differs card to card.
function ProfileCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg bg-surface p-5 shadow-resting">
      <h2 className="text-sm font-medium text-text-muted">{title}</h2>
      {children}
    </div>
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
  const [earnedBadges, streak, credits] = await Promise.all([
    db.query.badges.findMany({
      where: eq(badges.userId, user.id),
      orderBy: (b, { desc }) => desc(b.awardedAt),
    }),
    getStreak(user.id),
    getCredits(user.id),
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
      <ProfileCard title="Badges">
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
      </ProfileCard>

      {/* Phase 9: fills the placeholder this card has held since 7.5.F.
          --ember was reserved for "streaks/warnings" from the day it was
          named (DESIGN.md) but never actually used in UI chrome until now —
          same "show what already exists" move as the badge card above. */}
      <ProfileCard title="Streak">
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
      </ProfileCard>

      {/* Phase 9: the spendable half of the two-currency model — the
          leaderboard/dashboard points total stays a permanent, un-spendable
          rank signal; this balance is what'll actually pay for something
          once Shop v1 exists. */}
      <ProfileCard title="Credits">
        {!credits.hasEarned ? (
          <p className="mt-2 text-sm text-text-muted">
            None yet — pass a quest to start earning.
          </p>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <TokenIcon className="h-8 w-8 shrink-0 text-accent" />
            <div>
              <div className="font-mono text-base font-semibold tabular-nums text-text">
                {credits.balance.toLocaleString("en-US")} credits
              </div>
              <div className="text-xs text-text-muted">Spendable once the shop is live</div>
            </div>
          </div>
        )}
      </ProfileCard>
    </div>
  );
}
