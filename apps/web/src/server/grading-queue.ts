import { Queue } from "bullmq";
import { connection } from "./queue";

// Deliberately its own set of queues, never sharing with push-events.
// Ingestion is trusted, fast, structured work; grading runs untrusted code
// someone else wrote, at wall-clock costs an order of magnitude higher.
export type GradingJobData = {
  submissionId: string;
};

// One queue per runner type, not one shared queue — validated against
// BullMQ's own docs (multiple Queue/Worker instances sharing one Redis
// connection is the documented pattern; concurrency is a per-Worker/
// per-queue setting, not per-job-name within a shared queue, so different
// runner types wanting different concurrency need different queues).
// sandbox-exec stays low (TSan's scheduling sensitivity); io-match has no
// such constraint; git-assert is network-bound (the clone), not CPU-bound;
// dockerfile-check is the heaviest of the four (a real image build against
// an egress-allowlisted proxy), so it stays as conservative as sandbox-exec
// until there's real traffic to tune it against.
// Hyphenated, not colon-separated — BullMQ reserves `:` as its own Redis
// key delimiter internally and rejects a queue name containing one.
export const gradingQueues = {
  "sandbox-exec": new Queue<GradingJobData>("quest-grading-sandbox-exec", { connection }),
  "io-match": new Queue<GradingJobData>("quest-grading-io-match", { connection }),
  "git-assert": new Queue<GradingJobData>("quest-grading-git-assert", { connection }),
  "dockerfile-check": new Queue<GradingJobData>("quest-grading-dockerfile-check", { connection }),
} as const;

export type GradableRunner = keyof typeof gradingQueues;

export function isGradableRunner(runner: string): runner is GradableRunner {
  return runner in gradingQueues;
}
