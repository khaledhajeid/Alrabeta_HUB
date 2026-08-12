import { pgTable, text, timestamp, uuid, jsonb, boolean, integer, unique, index, pgEnum, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
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

// Independent of difficulty (see docs/MASTER_PLAN.md §1.5) — an easy Pure
// quest and a hard Educational quest both make sense, neither implies the
// other. "educational" = a short primer immediately before the challenge;
// "pure" = the full problem statement plus keyword/concept pointers for
// external research, no taught concept in-house. Defaults to "pure" only
// so `db:push` doesn't need an interactive per-row prompt for the existing
// 12 quests — every one of them gets an explicit, deliberately-chosen
// value during the Phase 7 retrofit (scripts/seed-quests.ts), not left to
// this default (§3.5: "not left to an implicit schema default that nobody
// actually chose").
export const questStyle = pgEnum("quest_style", ["educational", "pure"]);

// Which grading strategy judge.ts dispatches to — see src/server/runners/.
// sandbox-exec is the original (and only implemented) C/C++ sanitizer flow;
// the other three are Phase 7 additions, some not built yet (dockerfile-check
// deliberately last — see docs/MASTER_PLAN.md §9's Phase 7 entry for why).
export const questRunner = pgEnum("quest_runner", [
  "sandbox-exec",
  "io-match",
  "dockerfile-check",
  "git-assert",
]);

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
  style: questStyle("style").notNull().default("pure"),
  // Phase 8: the structural half of the Educational/Pure distinction —
  // style alone was just a label until now, both quest kinds shared one
  // promptMarkdown blob with the primer (if any) folded into the same
  // prose as the challenge. Educational quests get their concept primer
  // here, rendered as its own visually distinct surface before the
  // challenge; pure quests leave this null.
  primerMarkdown: text("primer_markdown"),
  // Pure quests' "keyword/concept pointers for external research" (see
  // docs/MASTER_PLAN.md §1.5) — kept out of promptMarkdown so the UI can
  // present them behind a progressive-disclosure reveal instead of inline,
  // the difference between a real hint and a disguised tutorial.
  researchKeywords: text("research_keywords").array().notNull().default([]),
  runner: questRunner("runner").notNull().default("sandbox-exec"),
  // Shape depends on `runner` — e.g. io-match's { entryFile, cases: [...] }.
  // sandbox-exec needs none of this (judge.sh works by file-extension
  // convention), so it stays null for every quest using that runner.
  runnerSpec: jsonb("runner_spec"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// A real normalized entity, not a tag or an enum on `quests` — see
// docs/MASTER_PLAN.md §3.5 for the full reasoning. An admin needs to
// author/draft/publish a path independent of any single quest inside it,
// the same reason `quests` itself has these columns.
//
// Phase 8.5: `paths` is the top-level curriculum category ("Backend
// Engineering Foundations") — it no longer owns quests directly. See
// `tracks` below for the tier that actually does.
export const paths = pgTable("paths", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  status: questStatus("status").notNull().default("draft"),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// An explicit authored choice, not inferred from a quest's tags — a track's
// icon is chosen once when the track is created, the same reasoning
// questStyle's own comment gives for not leaving a value to an implicit
// default nobody actually chose.
export const trackIcon = pgEnum("track_icon", ["git", "bash", "docker", "systems"]);

// Phase 8.5: the tier a flat `paths` -> `quests` model was missing — see
// docs/MASTER_PLAN.md's Phase 8.5 entry and decision 13. A track is a
// single-skill ordered quest sequence (Git, Bash/Linux, Docker, C/C++)
// belonging to exactly one path, matching the Path -> Track -> Module
// hierarchy Codecademy and Pluralsight both already use in production.
// Same reasoning as `paths` for why this is a real table and not a tag:
// a track needs its own title/summary/icon/ordering independent of any
// single quest inside it.
export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    pathId: uuid("path_id")
      .notNull()
      .references(() => paths.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    icon: trackIcon("icon").notNull(),
    // Position among this track's sibling tracks within the same path —
    // same shape as path_quests' old orderIndex, one tier up.
    orderIndex: integer("order_index").notNull(),
    status: questStatus("status").notNull().default("draft"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Two tracks in the same path can't claim the same slot.
    unique("tracks_path_order_unique").on(table.pathId, table.orderIndex),
    // Covers "fetch this path's tracks in order" as a single indexed scan.
    index("tracks_path_order_idx").on(table.pathId, table.orderIndex),
  ],
);

// A proper join table with its own `orderIndex` attribute, not an array of
// quest IDs on `tracks` and not a `trackId` column directly on `quests` —
// track membership is a relationship with its own data (position in the
// sequence), exactly the case a join table exists for. A quest belonging
// to exactly one track is the common case today, but nothing here assumes
// that; a foundational quest reused as the intro to two different tracks
// is a real many-to-many relationship this already supports, not a hack
// bolted on later. "Standalone" is simply the absence of a row here for a
// given quest, not a boolean flag anywhere — storing that as its own
// column would be redundant, derivable state. Replaces Phase 7's
// `path_quests` now that quests belong to a track, not a path, directly.
export const trackQuests = pgTable(
  "track_quests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A quest can't appear twice in the same track...
    unique("track_quests_track_quest_unique").on(table.trackId, table.questId),
    // ...and two quests can't claim the same slot in a track.
    unique("track_quests_track_order_unique").on(table.trackId, table.orderIndex),
    // Covers "fetch this track's quests in order" as a single indexed scan
    // (equality column first, sort column last) rather than a sort step —
    // same indexing discipline as quest_submissions' covering index above.
    index("track_quests_track_order_idx").on(table.trackId, table.orderIndex),
  ],
);

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
    // Raw judge.sh verdict for this submission — valgrind/asan_ubsan/tsan
    // results, verdict, duration. Null until the grading worker picks the
    // job up; kept as the untouched JSON (mirrors webhookEvents' approach)
    // so badges.ts and any future UI can read the full detail without a
    // second schema for it.
    judgeOutput: jsonb("judge_output"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Covering the badge-eligibility "is this the user's first submission
    // to this quest" query (orders by submittedAt ASC LIMIT 1 within a
    // questId+userId match) — equality columns first, sort column last, so
    // Postgres can satisfy the WHERE and the ORDER BY from the same index
    // scan without a separate sort step. Supersedes the older
    // (questId, userId)-only index: any query that only needs that pair
    // still uses this one via its leftmost prefix, so keeping both would
    // just be redundant bloat.
    index("quest_submissions_quest_user_submitted_idx").on(
      table.questId,
      table.userId,
      table.submittedAt,
    ),
    // Same commit shouldn't be recorded as a submission twice regardless of
    // circumstance (webhook retry edge cases, etc.) — same idempotency
    // discipline as every other table in the ingestion pipeline.
    unique("quest_submissions_quest_commit_unique").on(table.questId, table.commitSha),
  ],
);

// Awarded by the grading worker (Violet-tier: zero-leak, race-free), never
// by hand. One row per (user, badge) — re-earning the same badge on a later
// quest doesn't duplicate it, which is also what makes awarding idempotent
// against a retried grading job.
export const badges = pgTable(
  "badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(), // e.g. "zero-leak", "race-free"
    questSubmissionId: uuid("quest_submission_id")
      .notNull()
      .references(() => questSubmissions.id, { onDelete: "cascade" }),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("badges_user_slug_unique").on(table.userId, table.slug)],
);

// Phase 9: the spendable half of the two-currency model (permanent
// points/rank on the leaderboard, unaffected by this table, vs. this
// spendable balance). A ledger, not a stored balance column — same
// "derive from source of truth, never cache a running total" posture as
// points/streak already use, and it gives Shop v1's purchases and
// admin-granted real-world rewards a natural home as rows here too.
export const creditReason = pgEnum("credit_reason", [
  "quest_passed",
  "admin_grant",
  "shop_purchase",
]);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Signed: positive for quest_passed/admin_grant, negative for the
    // future shop_purchase. A user's balance is sum(amount) over their rows.
    amount: integer("amount").notNull(),
    reason: creditReason("reason").notNull(),
    // Set only for reason = "quest_passed"; null for admin_grant/shop_purchase.
    // set null (not cascade) on quest deletion — an earned credit is history,
    // not a live view, so it must survive the quest it was earned from being
    // removed later; only the traceability link is lost.
    questId: uuid("quest_id").references(() => quests.id, { onDelete: "set null" }),
    // Admin-grant memo (e.g. "real-world reward: t-shirt") — always null for
    // quest_passed rows, which are self-explanatory via questId.
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Blocks double-earning credits on a quest resubmit. Postgres treats
    // NULLs as distinct in a unique constraint, so admin_grant/shop_purchase
    // rows (questId null) never collide with each other here.
    unique("credit_transactions_user_quest_unique").on(table.userId, table.questId),
    // Enforces at the schema level what was previously only a comment:
    // questId is only ever set for quest_passed rows. Without this, a
    // future admin_grant tied to a questId the user already has a
    // quest_passed row for would silently no-op against the unique
    // constraint above instead of failing loudly.
    check(
      "credit_transactions_quest_id_only_for_quest_passed",
      sql`${table.reason} = 'quest_passed' OR ${table.questId} IS NULL`,
    ),
  ],
);

// Shop v1: what Credits actually buy. "flair"/"title" are owned-forever
// cosmetics (can own several, equip one at a time); "activity_feature" and
// "real_world_reward" are repeatable — each purchase is its own redemption,
// not a thing you "have" afterward.
export const shopItemCategory = pgEnum("shop_item_category", [
  "flair",
  "title",
  "activity_feature",
  "real_world_reward",
]);

// No admin panel yet (that's Phase 10) — this table is authored via
// scripts/seed-shop-items.ts, the same precedent seed-quests.ts set for
// quests before an admin UI existed.
export const shopItems = pgTable("shop_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: shopItemCategory("category").notNull(),
  price: integer("price").notNull(),
  // The literal glyph rendered next to a username when a "flair" item is
  // equipped (e.g. "◆"). Null for every other category.
  flairGlyph: text("flair_glyph"),
  // "flair"/"title" are false (buyable once, then owned); "activity_feature"/
  // "real_world_reward" are true (every purchase is a fresh redemption).
  repeatable: boolean("repeatable").notNull().default(false),
  // Null = unlimited. Only meaningful for real_world_reward items an admin
  // wants capped (e.g. one "dinner on me" total) — checked against a live
  // COUNT(*) of shop_purchases at purchase time, not decremented in place,
  // so it can never drift from the actual redemption history.
  stock: integer("stock"),
  // Lets an admin retire an item (stop it from being purchasable) without
  // deleting it and orphaning past purchases' history.
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shopPurchases = pgTable("shop_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // restrict, not cascade/set null: a purchase is a financial record (it has
  // a matching credit_transactions debit) and must always be traceable to
  // what was bought — retiring an item is `active: false`, never a delete.
  itemId: uuid("item_id")
    .notNull()
    .references(() => shopItems.id, { onDelete: "restrict" }),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  // Only set for category = "activity_feature": the boost this purchase
  // bought stays active until this timestamp (purchasedAt + 24h). Null for
  // every other category — it's not "when did this expire," it's "did this
  // purchase grant a time-boxed effect at all."
  featuredUntil: timestamp("featured_until", { withTimezone: true }),
});

// One row per (user, category) — the currently-equipped item for that slot.
// Deliberately not a column on `user`: that table is Better Auth-owned
// (auth-schema.ts, regenerated by `npx auth generate`, never hand-edited).
// In practice category is always "flair" or "title" (the only equippable
// kinds); nothing stops equipping a repeatable category's item, but nothing
// ever calls equipItem() with one either.
export const equippedCosmetics = pgTable(
  "equipped_cosmetics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    category: shopItemCategory("category").notNull(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => shopItems.id, { onDelete: "cascade" }),
  },
  (table) => [unique("equipped_cosmetics_user_category_unique").on(table.userId, table.category)],
);

export const shopPurchasesRelations = relations(shopPurchases, ({ one }) => ({
  item: one(shopItems, { fields: [shopPurchases.itemId], references: [shopItems.id] }),
  user: one(user, { fields: [shopPurchases.userId], references: [user.id] }),
}));

export const equippedCosmeticsRelations = relations(equippedCosmetics, ({ one }) => ({
  item: one(shopItems, { fields: [equippedCosmetics.itemId], references: [shopItems.id] }),
  user: one(user, { fields: [equippedCosmetics.userId], references: [user.id] }),
}));

export const questsRelations = relations(quests, ({ one, many }) => ({
  author: one(user, { fields: [quests.authorId], references: [user.id] }),
  trackQuests: many(trackQuests),
}));

export const pathsRelations = relations(paths, ({ one, many }) => ({
  author: one(user, { fields: [paths.authorId], references: [user.id] }),
  tracks: many(tracks),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  path: one(paths, { fields: [tracks.pathId], references: [paths.id] }),
  author: one(user, { fields: [tracks.authorId], references: [user.id] }),
  trackQuests: many(trackQuests),
}));

export const trackQuestsRelations = relations(trackQuests, ({ one }) => ({
  track: one(tracks, { fields: [trackQuests.trackId], references: [tracks.id] }),
  quest: one(quests, { fields: [trackQuests.questId], references: [quests.id] }),
}));

// Phase 9: the leaderboard needs "this passed submission's quest.points and
// quest.status" and the relational query API can't join without a declared
// relation — every other FK-bearing table already has one of these, this
// one was just never needed until a query had to reach across it.
export const questSubmissionsRelations = relations(questSubmissions, ({ one }) => ({
  quest: one(quests, { fields: [questSubmissions.questId], references: [quests.id] }),
  user: one(user, { fields: [questSubmissions.userId], references: [user.id] }),
}));
