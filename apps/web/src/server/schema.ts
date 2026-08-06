import { pgTable, text, timestamp, uuid, jsonb, boolean } from "drizzle-orm/pg-core";

// User identity (user/session/account/verification) lives in ./auth-schema.ts,
// owned by Better Auth — regenerate it with `npx auth generate`, don't hand-edit.

// Raw log of every Forgejo webhook delivery. The worker consumes these;
// keeping the untouched payload lets us replay a delivery if a later
// processing step (review, badges) changes without needing Forgejo to resend.
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  event: text("event").notNull(), // e.g. "push"
  deliveryId: text("delivery_id").notNull().unique(),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").notNull().default(false),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});
