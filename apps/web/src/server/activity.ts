import IORedis from "ioredis";
import { desc } from "drizzle-orm";
import { db } from "./db";
import { activityEvents } from "./schema";

// A dedicated connection, deliberately not the one exported from queue.ts —
// once a connection issues SUBSCRIBE it can't run normal commands, so the
// pub/sub side needs to stay decoupled from BullMQ's connection lifecycle.
const publisher = new IORedis(process.env.REDIS_URL!);

export const ACTIVITY_CHANNEL = "alrabeta:activity";

export type ActivityEvent = {
  type: "push";
  repo: string;
  branch: string;
  pusher: string;
  commitCount: number;
  headMessage: string | null;
  at: string;
};

// Writes the durable record first, then fans it out live — commitCount here
// is whatever ingestPush actually did (including a resync's backfilled
// count), not just what the triggering webhook payload happened to report.
export async function publishActivity(event: Omit<ActivityEvent, "at">): Promise<ActivityEvent> {
  const [row] = await db
    .insert(activityEvents)
    .values({
      repo: event.repo,
      branch: event.branch,
      pusher: event.pusher,
      commitCount: event.commitCount,
      headMessage: event.headMessage,
    })
    .returning();

  const full: ActivityEvent = { ...event, at: row.createdAt.toISOString() };
  await publisher.publish(ACTIVITY_CHANNEL, JSON.stringify(full));
  return full;
}

// Seeds the feed with history on first load, before any live SSE event has
// arrived — reads the same table a live event was written to, so the
// initial view and anything that streams in afterward always agree.
export async function getRecentActivity(limit = 15): Promise<ActivityEvent[]> {
  const rows = await db.query.activityEvents.findMany({
    orderBy: desc(activityEvents.createdAt),
    limit,
  });

  return rows.map((row) => ({
    type: "push",
    repo: row.repo,
    branch: row.branch,
    pusher: row.pusher,
    commitCount: row.commitCount,
    headMessage: row.headMessage,
    at: row.createdAt.toISOString(),
  }));
}
