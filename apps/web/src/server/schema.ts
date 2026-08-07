import { pgTable, text, timestamp, uuid, jsonb, boolean, integer, unique, index, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth-schema";

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

export const repos = pgTable("repos", {
  id: uuid("id").primaryKey().defaultRandom(),
  forgejoId: integer("forgejo_id").notNull().unique(),
  ownerLogin: text("owner_login").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull().unique(),
  description: text("description"),
  private: boolean("private").notNull().default(true),
  defaultBranch: text("default_branch").notNull(),
  htmlUrl: text("html_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// The last known tip of each branch we've ingested. This is the
// reconciliation cursor: a push's `before` SHA is compared against
// headSha here to detect a dropped webhook or a rewritten history
// (force push) — both look identical from this table's point of view,
// and both are handled the same way (see ingest.ts): re-fetch the
// branch's real commit list from the Forgejo API instead of trusting
// the webhook payload.
export const repoRefs = pgTable(
  "repo_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    ref: text("ref").notNull(), // e.g. "refs/heads/main"
    headSha: text("head_sha").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("repo_refs_repo_ref_unique").on(table.repoId, table.ref)],
);

// Append-only by design: a commit's sha is a hash of its content, so once
// seen it never needs updating — ON CONFLICT DO NOTHING on (repoId, sha) is
// the whole idempotency story. A force push that supersedes a commit does
// not delete its row here; this table is "everything ever pushed," not
// "the current state of the branch" (that's what repoRefs is for).
export const commits = pgTable(
  "commits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    sha: text("sha").notNull(),
    branch: text("branch").notNull(),
    message: text("message").notNull(),
    authorName: text("author_name").notNull(),
    authorEmail: text("author_email"),
    // Forgejo's own match of the git author email to a registered account,
    // when there is one — not necessarily the same as who pushed.
    authorUsername: text("author_username"),
    authoredAt: timestamp("authored_at", { withTimezone: true }).notNull(),
    url: text("url").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("commits_repo_sha_unique").on(table.repoId, table.sha),
    index("commits_repo_authored_idx").on(table.repoId, table.authoredAt),
  ],
);

// Durable record of what the activity feed showed, written by the same
// ingestPush call that publishes the live SSE event — deliberately not
// reconstructed from webhook_events' raw payload, which only reflects what
// Forgejo *reported* for a single push and would undercount a resynced
// push's real commitCount (backfilled commits aren't in that payload at all).
export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repo: text("repo").notNull(),
    branch: text("branch").notNull(),
    pusher: text("pusher").notNull(),
    commitCount: integer("commit_count").notNull(),
    headMessage: text("head_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("activity_events_created_idx").on(table.createdAt)],
);

export const questDifficulty = pgEnum("quest_difficulty", ["easy", "medium", "hard"]);
export const questStatus = pgEnum("quest_status", ["draft", "published"]);

export const quests = pgTable("quests", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  // Plain text, not markdown — the one-line preview on /quests. Keeping it
  // a distinct field instead of truncating promptMarkdown avoids showing a
  // half-rendered heading or a code fence cut mid-block in the list view.
  summary: text("summary").notNull(),
  promptMarkdown: text("prompt_markdown").notNull(),
  difficulty: questDifficulty("difficulty").notNull(),
  tags: text("tags").array().notNull().default([]),
  points: integer("points").notNull(),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id),
  status: questStatus("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const submissionStatus = pgEnum("submission_status", [
  "submitted",
  "passed",
  "failed",
  "needs_review",
]);

// Populated by convention: a push to a branch named quest/<slug> gets
// auto-detected during ingestion and creates a row here — no separate
// "submit" form. That detection isn't wired up yet (separate follow-up
// work); this table exists now so the quest detail page has something
// real to query against once it is, rather than a UI built against a
// shape that doesn't exist yet.
export const questSubmissions = pgTable(
  "quest_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    branch: text("branch").notNull(),
    commitSha: text("commit_sha").notNull(),
    status: submissionStatus("status").notNull().default("submitted"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quest_submissions_quest_user_idx").on(table.questId, table.userId),
    // Same commit shouldn't be recorded as a submission twice regardless of
    // circumstance (webhook retry edge cases, etc.) — same idempotency
    // discipline as every other table in the ingestion pipeline.
    unique("quest_submissions_quest_commit_unique").on(table.questId, table.commitSha),
  ],
);

export const questsRelations = relations(quests, ({ one }) => ({
  author: one(user, { fields: [quests.authorId], references: [user.id] }),
}));
