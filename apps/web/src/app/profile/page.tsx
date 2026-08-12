import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { badges } from "@/server/schema";
import { BadgePill } from "@/components/badge-pill";
import { getStreak } from "@/server/streak";
import { getCredits } from "@/server/credits";
import { getUserShopState } from "@/server/shop";
import { FlameIcon, TokenIcon } from "@/components/gamification-icons";
import { FlairIcon } from "@/components/shop-icons";

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
  const [earnedBadges, streak, credits, shopState] = await Promise.all([
    db.query.badges.findMany({
      where: eq(badges.userId, user.id),
      orderBy: (b, { desc }) => desc(b.awardedAt),
    }),
    getStreak(user.id),
    getCredits(user.id),
    getUserShopState(user.id),
  ]);
  const equippedTitle = shopState.equippedByCategory.title ?? null;
  const equippedFlair = shopState.equippedByCategory.flair ?? null;

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
          <div className="flex items-center gap-1.5">
            {equippedFlair?.flairGlyph && (
              <FlairIcon glyph={equippedFlair.flairGlyph} className="h-4 w-4 shrink-0 text-accent" />
            )}
            <span className="text-base font-medium text-text">{user.name}</span>
            {equippedTitle && (
              <span className="text-xs text-text-muted">&middot; {equippedTitle.name}</span>
            )}
          </div>
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
          rank signal; this balance is what actually pays for something in
          the shop below, live as of Shop v1. */}
      <ProfileCard title="Credits">
        {!credits.hasEarned ? (
          <p className="mt-2 text-sm text-text-muted">
            None yet — pass a quest to start earning.
          </p>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <TokenIcon className="h-8 w-8 shrink-0 text-accent" />
              <div className="font-mono text-base font-semibold tabular-nums text-text">
                {credits.balance.toLocaleString("en-US")} credits
              </div>
            </div>
            <Link
              href="/shop"
              className="shrink-0 text-xs font-medium text-accent transition-colors hover:text-accent-strong"
            >
              Spend in the shop &rarr;
            </Link>
          </div>
        )}
      </ProfileCard>
    </div>
  );
}
