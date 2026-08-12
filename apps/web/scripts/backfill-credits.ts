// One-time backfill for the credit_transactions ledger introduced in
// Phase 9's currency slice: without this, everyone's spendable balance
// starts at 0 while their leaderboard points total isn't, for every quest
// they'd already passed before this feature shipped. Idempotent — a
// single bulk insert with onConflictDoNothing reuses the same (userId,
// questId) unique-constraint guard awardCreditsIfEligible relies on, so
// re-running it is a safe no-op for anything already credited.
//
// Run via `npm run db:backfill-credits` — that script passes
// --env-file=.env.local itself.
import { eq } from "drizzle-orm";
import { db } from "../src/server/db";
import { creditTransactions, questSubmissions } from "../src/server/schema";

async function main() {
  const passed = await db.query.questSubmissions.findMany({
    where: eq(questSubmissions.status, "passed"),
    columns: { questId: true, userId: true },
    with: { quest: { columns: { points: true, status: true } } },
  });

  // Dedupe by (userId, questId) before insert — a regrade can leave more
  // than one passing submission for the same quest, and only published
  // quests count, same eligibility rule as awardCreditsIfEligible.
  const rowsByKey = new Map<string, { userId: string; questId: string; amount: number }>();
  for (const s of passed) {
    if (s.quest.status !== "published") continue;
    rowsByKey.set(`${s.userId}:${s.questId}`, {
      userId: s.userId,
      questId: s.questId,
      amount: s.quest.points,
    });
  }

  const rows = [...rowsByKey.values()].map((r) => ({ ...r, reason: "quest_passed" as const }));
  if (rows.length === 0) {
    console.log("[backfill-credits] nothing to backfill");
    return;
  }

  const inserted = await db.insert(creditTransactions).values(rows).onConflictDoNothing().returning();
  const totalAmount = inserted.reduce((sum, r) => sum + r.amount, 0);

  console.log(
    `[backfill-credits] scanned ${passed.length} passed submissions, ${rows.length} eligible (userId, questId) pairs, credited ${inserted.length} new, +${totalAmount} total credits`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
