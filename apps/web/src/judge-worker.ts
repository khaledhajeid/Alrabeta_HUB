// See worker.ts for why env vars must come from --env-file=.env.local (the
// package.json script flag), not an in-file dotenv import — same ESM
// module-init-order hazard applies here.
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { questSubmissions, quests, repos } from "@/server/schema";
import { connection } from "@/server/queue";
import { type GradingJobData } from "@/server/grading-queue";
import { judgeSubmission } from "@/server/judge";
import { awardBadgesIfEligible } from "@/server/badges";

// Concurrency capped well below the ingestion worker's — each job here
// shells out to `docker run` and drives valgrind + up to two sanitizer
// builds, and TSan's race detection is sensitive to host scheduling load:
// too many of these running at once risks false negatives, not just slowness.
const CONCURRENCY = 2;

const worker = new Worker<GradingJobData>(
  "quest-grading",
  async (job) => {
    const submission = await db.query.questSubmissions.findFirst({
      where: eq(questSubmissions.id, job.data.submissionId),
    });
    if (!submission) {
      console.warn(`[judge-worker] no quest_submissions row for ${job.data.submissionId}, skipping`);
      return;
    }

    const [quest, repo] = await Promise.all([
      db.query.quests.findFirst({ where: eq(quests.id, submission.questId) }),
      db.query.repos.findFirst({ where: eq(repos.id, submission.repoId) }),
    ]);
    if (!quest || !repo) {
      console.warn(`[judge-worker] submission ${submission.id} missing quest or repo, skipping`);
      return;
    }

    const verdict = await judgeSubmission({
      ownerLogin: repo.ownerLogin,
      repoName: repo.name,
      commitSha: submission.commitSha,
    });

    const status = verdict.verdict === "failed" ? "failed" : "passed";

    await db
      .update(questSubmissions)
      .set({ judgeOutput: verdict, status })
      .where(eq(questSubmissions.id, submission.id));

    const awarded = await awardBadgesIfEligible({
      submissionId: submission.id,
      questId: quest.id,
      userId: submission.userId,
      verdict,
    });

    console.log(
      `[judge-worker] graded submission=${submission.id} quest=${quest.slug} verdict=${verdict.verdict} status=${status}`,
      awarded.length ? `badges=${awarded.join(",")}` : "",
    );
  },
  { connection, concurrency: CONCURRENCY },
);

worker.on("completed", (job) => {
  console.log(`[judge-worker] done submission=${job.data.submissionId}`);
});

worker.on("failed", (job, err) => {
  console.error(`[judge-worker] failed submission=${job?.data.submissionId}:`, err.message);
});

worker.on("error", (err) => {
  console.error("[judge-worker] error:", err);
});

console.log("[judge-worker] listening on quest-grading");
