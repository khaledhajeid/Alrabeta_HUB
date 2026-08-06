import { Queue } from "bullmq";
import IORedis from "ioredis";

// BullMQ requires this for its blocking commands; without it ioredis
// gives up retrying and jobs silently stop moving.
export const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export type PushJobData = {
  webhookEventId: string;
  deliveryId: string;
};

export const pushQueue = new Queue<PushJobData>("push-events", { connection });
