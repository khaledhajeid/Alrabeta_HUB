// Env vars come from the runtime's --env-file=.env.local flag (see
// package.json), not an in-file dotenv import. ESM hoists imports above the
// rest of a module's top-level code, so an in-file `dotenv.config()` call
// here would run AFTER queue.ts/db.ts have already read process.env at
// their own module scope — they'd silently init against undefined URLs
// (defaulting to whatever's listening on the standard ports) instead of
// failing loudly. Cost a real debugging session to find; don't reintroduce it.
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/schema";
import { connection, type PushJobData } from "@/server/queue";

const worker = new Worker<PushJobData>(
  "push-events",
  async (job) => {
    // Phase 2 will turn this into: fetch the commit range from Forgejo,
    // upsert repo/commit rows, push an activity-feed event over the
    // WebSocket layer. For now, prove the pipeline end-to-end.
    console.log(`[worker] processing ${job.name} delivery=${job.data.deliveryId}`);

    await db
      .update(webhookEvents)
      .set({ processed: true })
      .where(eq(webhookEvents.id, job.data.webhookEventId));
  },
  { connection, concurrency: 4 },
);

worker.on("completed", (job) => {
  console.log(`[worker] done delivery=${job.data.deliveryId}`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] failed delivery=${job?.data.deliveryId}:`, err.message);
});

worker.on("error", (err) => {
  console.error("[worker] error:", err);
});

worker.on("active", (job) => {
  console.log(`[worker] active delivery=${job.data.deliveryId}`);
});

console.log("[worker] listening on push-events");
