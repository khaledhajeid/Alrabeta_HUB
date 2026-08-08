// See worker.ts for why env vars must come from --env-file=.env.local (the
// package.json script flag), not an in-file dotenv import — same ESM
// module-init-order hazard applies here.
import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { questSubmissions, quests, repos } from "@/server/schema";
import { connection } from "@/server/queue";
import { type GradableRunner, type GradingJobData } from "@/server/grading-queue";
import { judgeSubmission } from "@/server/judge";
import { awardBadgesIfEligible } from "@/server/badges";

async function processGradingJob(job: Job<GradingJobData>) {
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
    runner: quest.runner,
    runnerSpec: quest.runnerSpec,
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
    `[judge-worker] graded submission=${submission.id} quest=${quest.slug} runner=${quest.runner} verdict=${verdict.verdict} status=${status}`,
    awarded.length ? `badges=${awarded.join(",")}` : "",
  );
}

// Concurrency is tuned per runner type, which is exactly why these are
// separate queues/workers rather than one shared queue — see
// grading-queue.ts. sandbox-exec stays low: each job shells out to
// `docker run` and drives valgrind + up to two sanitizer builds, and
// TSan's race detection is sensitive to host scheduling load. io-match has
// no such constraint (no sanitizers, no scheduling-sensitive detection),
// so it can run substantially more jobs in parallel. git-assert sits
// between the two: its cost is a `git clone` (network/IO-bound, not CPU-
// bound like sandbox-exec) against the Forgejo host, so higher than
// sandbox-exec is safe, but unbounded concurrency would just turn into
// self-inflicted load on that one host — moderate until there's a reason
// to tune it under real traffic.
const CONCURRENCY: Record<GradableRunner, number> = {
  "sandbox-exec": 2,
  "io-match": 8,
  "git-assert": 4,
};

(Object.keys(CONCURRENCY) as GradableRunner[]).forEach((runner) => {
  const worker = new Worker<GradingJobData>(`quest-grading-${runner}`, processGradingJob, {
    connection,
    concurrency: CONCURRENCY[runner],
  });

  worker.on("completed", (job) => {
    console.log(`[judge-worker:${runner}] done submission=${job.data.submissionId}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[judge-worker:${runner}] failed submission=${job?.data.submissionId}:`, err.message);
  });
  worker.on("error", (err) => {
    console.error(`[judge-worker:${runner}] error:`, err);
  });

  console.log(`[judge-worker] listening on quest-grading-${runner} (concurrency ${CONCURRENCY[runner]})`);
});
