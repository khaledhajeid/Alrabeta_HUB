import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { quests, questSubmissions } from "./schema";
import { account } from "./auth-schema";
import { gradingQueue } from "./grading-queue";
import { GRADABLE_TAGS } from "./badges";

const QUEST_BRANCH_PREFIX = "quest/";

/**
 * A quest submission is a superset behavior on top of a normal push, never
 * a different code path for one — this only ever adds a row, it never
 * changes how the push itself gets ingested. Every early return here is a
 * legitimate "not a submission," not an error:
 *
 *   - branch doesn't start with quest/           → ordinary branch
 *   - slug doesn't match a published quest        → coincidental name, typo,
 *                                                    someone's personal
 *                                                    convention
 *   - pusher has no linked Hub account            → they have Forgejo
 *                                                    access but have never
 *                                                    signed into the Hub;
 *                                                    the push still ingests
 *                                                    normally, just without
 *                                                    attribution
 */
export async function recordQuestSubmissionIfApplicable(params: {
  branch: string;
  repoId: string;
  commitSha: string;
  pusherForgejoId: number;
}) {
  if (!params.branch.startsWith(QUEST_BRANCH_PREFIX)) return null;

  const slug = params.branch.slice(QUEST_BRANCH_PREFIX.length);
  if (!slug) return null;

  const quest = await db.query.quests.findFirst({
    where: and(eq(quests.slug, slug), eq(quests.status, "published")),
  });
  if (!quest) return null;

  const linkedAccount = await db.query.account.findFirst({
    where: and(eq(account.providerId, "forgejo"), eq(account.accountId, String(params.pusherForgejoId))),
  });
  if (!linkedAccount) {
    console.warn(
      `[quests] push to ${params.branch} by forgejo user ${params.pusherForgejoId} — no linked Hub account, skipping submission record`,
    );
    return null;
  }

  const [submission] = await db
    .insert(questSubmissions)
    .values({
      questId: quest.id,
      userId: linkedAccount.userId,
      repoId: params.repoId,
      branch: params.branch,
      commitSha: params.commitSha,
    })
    .onConflictDoNothing()
    .returning();

  if (submission) {
    console.log(`[quests] submission recorded: ${quest.slug} by user ${linkedAccount.userId}`);

    if (quest.tags.some((tag) => GRADABLE_TAGS.includes(tag))) {
      await gradingQueue.add("grade", { submissionId: submission.id });
      console.log(`[quests] grading job enqueued: submission=${submission.id}`);
    }
  }

  return submission ?? null;
}
