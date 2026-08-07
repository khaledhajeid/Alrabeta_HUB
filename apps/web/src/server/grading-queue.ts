import { Queue } from "bullmq";
import { connection } from "./queue";

// Deliberately its own queue and its own worker process (judge-worker.ts),
// never sharing either with push-events. Ingestion is trusted, fast,
// structured work; grading runs untrusted code someone else wrote, at
// wall-clock costs an order of magnitude higher — a slow or hung
// submission here must never back up the activity feed.
export type GradingJobData = {
  submissionId: string;
};

export const gradingQueue = new Queue<GradingJobData>("quest-grading", { connection });
