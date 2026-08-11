import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { questSubmissions } from "./schema";

export type StreakData = {
  current: number;
  longest: number;
  hasEverPassed: boolean;
};

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDayMs(key: string): number {
  return Date.parse(`${key}T00:00:00.000Z`);
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Shared by both the current-streak and longest-streak walks below, so a
// future change to the adjacency rule (e.g. a grace day) can't be applied
// to one walk and silently forgotten in the other.
function isConsecutiveDay(laterKey: string, earlierKey: string): boolean {
  return utcDayMs(laterKey) - utcDayMs(earlierKey) === ONE_DAY_MS;
}

// Consecutive-day streak: any passing submission counts toward that UTC
// calendar day, even a resubmit of an already-passed quest (Phase 9 shape
// decision — simplest rule, matches GitHub's contribution-streak model, and
// gaming it isn't a real risk at 14 trusted users). Computed in UTC rather
// than each user's local time to avoid per-user timezone state for a v1.
export async function getStreak(userId: string): Promise<StreakData> {
  const passed = await db.query.questSubmissions.findMany({
    where: and(eq(questSubmissions.userId, userId), eq(questSubmissions.status, "passed")),
    columns: { submittedAt: true },
  });

  if (passed.length === 0) {
    return { current: 0, longest: 0, hasEverPassed: false };
  }

  // Newest first — ISO day-keys sort lexicographically, so string compare
  // is enough without re-parsing back to Date.
  const dayKeys = [...new Set(passed.map((s) => toUtcDayKey(s.submittedAt)))].sort((a, b) =>
    a < b ? 1 : -1,
  );

  // Walks from today (or yesterday, so visiting your profile before you've
  // submitted anything today doesn't show a false break) backward while
  // each day is exactly one calendar day before the last.
  const todayKey = toUtcDayKey(new Date());
  const yesterdayKey = toUtcDayKey(new Date(Date.now() - ONE_DAY_MS));
  let current = 0;
  if (dayKeys[0] === todayKey || dayKeys[0] === yesterdayKey) {
    current = 1;
    for (let i = 1; i < dayKeys.length; i++) {
      if (!isConsecutiveDay(dayKeys[i - 1], dayKeys[i])) break;
      current++;
    }
  }

  // Longest streak: same consecutive-day walk, but over the full history
  // instead of stopping at the first gap.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < dayKeys.length; i++) {
    run = isConsecutiveDay(dayKeys[i - 1], dayKeys[i]) ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  return { current, longest, hasEverPassed: true };
}
