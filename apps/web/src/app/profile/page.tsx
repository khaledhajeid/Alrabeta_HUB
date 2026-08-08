import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { badges } from "@/server/schema";
import { BadgePill } from "@/components/badge-pill";

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
  const earnedBadges = await db.query.badges.findMany({
    where: eq(badges.userId, user.id),
    orderBy: (b, { desc }) => desc(b.awardedAt),
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-xl font-semibold text-text">Profile</h1>

      <div className="mt-6 flex items-center gap-4 rounded-lg bg-surface p-5 shadow-resting">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Forgejo avatar
          <img src={user.image} alt="" className="h-14 w-14 rounded-full" />
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
          gamification mechanics. Two-currency/streaks/shop stay Phase 8. */}
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

      <div className="mt-4 rounded-lg border border-dashed border-line px-5 py-10 text-center">
        <p className="text-sm text-text-muted">
          Contribution graph, streak, and points fill in once gamification lands.
        </p>
      </div>
    </div>
  );
}
