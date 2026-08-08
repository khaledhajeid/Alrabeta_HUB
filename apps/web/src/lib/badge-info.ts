// Display metadata for badge slugs — deliberately separate from
// server/badges.ts, which owns the actual grading/awarding logic and pulls
// in server-only types (JudgeVerdict) this file must stay safe to import
// from client components without dragging along. Keep the slugs and the
// tag → badge mapping in sync with server/badges.ts's TAG_BADGE_MAP by
// hand; there are only two entries today, and this is read-only display
// data, not the eligibility check itself.
export const BADGE_INFO: Record<string, { label: string; description: string }> = {
  "zero-leak": {
    label: "Zero-Leak",
    description: "Valgrind clean on a memory quest — no leaks, ever, not just this once.",
  },
  "race-free": {
    label: "Race-Free",
    description: "ThreadSanitizer clean on a multithreading quest — no data races, actually verified.",
  },
};

// Which tag makes a quest eligible for which badge, for *display* purposes
// (shown before a quest is ever solved, so the badge system isn't a total
// surprise the first time someone earns one). Mirrors server/badges.ts's
// TAG_BADGE_MAP keys.
export const TAG_TO_BADGE_SLUG: Record<string, string> = {
  memory: "zero-leak",
  multithreading: "race-free",
};
