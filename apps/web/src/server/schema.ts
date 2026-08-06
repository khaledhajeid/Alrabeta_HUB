import { pgTable, text, timestamp, uuid, jsonb, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  forgejoId: text("forgejo_id").notNull().unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
