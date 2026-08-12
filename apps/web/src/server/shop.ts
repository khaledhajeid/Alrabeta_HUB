import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { user } from "./auth-schema";
import { creditTransactions, equippedCosmetics, shopItems, shopPurchases } from "./schema";
import { getCreditsBalance } from "./credits";

export type ShopItem = typeof shopItems.$inferSelect;
export type ShopItemCategory = ShopItem["category"];
// Only meaningful when the item's own `stock` is non-null — the number of
// redemptions still available, live-computed from shop_purchases rather
// than decremented in place (same "derive from source of truth" posture as
// Credits' own balance).
export type CatalogItem = ShopItem & { remaining: number | null };

export type ShopCatalog = {
  flair: CatalogItem[];
  title: CatalogItem[];
  activityFeature: CatalogItem[];
  realWorldReward: CatalogItem[];
};

export async function getCatalog(): Promise<ShopCatalog> {
  const items = await db.query.shopItems.findMany({
    where: eq(shopItems.active, true),
    orderBy: (i, { asc }) => [asc(i.price)],
  });

  const cappedIds = items.filter((i) => i.stock !== null).map((i) => i.id);
  const counts = cappedIds.length
    ? await db
        .select({ itemId: shopPurchases.itemId, n: count() })
        .from(shopPurchases)
        .where(inArray(shopPurchases.itemId, cappedIds))
        .groupBy(shopPurchases.itemId)
    : [];
  const countByItem = new Map(counts.map((r) => [r.itemId, Number(r.n)]));

  const withRemaining: CatalogItem[] = items.map((i) => ({
    ...i,
    remaining: i.stock === null ? null : Math.max(0, i.stock - (countByItem.get(i.id) ?? 0)),
  }));

  return {
    flair: withRemaining.filter((i) => i.category === "flair"),
    title: withRemaining.filter((i) => i.category === "title"),
    activityFeature: withRemaining.filter((i) => i.category === "activity_feature"),
    realWorldReward: withRemaining.filter((i) => i.category === "real_world_reward"),
  };
}

export type UserShopState = {
  // Every item this user has ever purchased at least once — for repeatable
  // categories this is "have you ever bought one," not "do you own it,"
  // since a repeatable purchase isn't a possession.
  ownedItemIds: Set<string>;
  equippedByCategory: Partial<Record<ShopItemCategory, ShopItem>>;
  activeFeatureUntil: Date | null;
};

export async function getUserShopState(userId: string): Promise<UserShopState> {
  const [purchases, equipped] = await Promise.all([
    db.query.shopPurchases.findMany({ where: eq(shopPurchases.userId, userId) }),
    db.query.equippedCosmetics.findMany({
      where: eq(equippedCosmetics.userId, userId),
      with: { item: true },
    }),
  ]);

  const equippedByCategory: UserShopState["equippedByCategory"] = {};
  for (const e of equipped) equippedByCategory[e.category] = e.item;

  const now = Date.now();
  let activeFeatureUntil: Date | null = null;
  for (const p of purchases) {
    if (p.featuredUntil && p.featuredUntil.getTime() > now) {
      if (!activeFeatureUntil || p.featuredUntil > activeFeatureUntil) activeFeatureUntil = p.featuredUntil;
    }
  }

  return {
    ownedItemIds: new Set(purchases.map((p) => p.itemId)),
    equippedByCategory,
    activeFeatureUntil,
  };
}

export type PurchaseError =
  | "item_not_found"
  | "item_inactive"
  | "already_owned"
  | "out_of_stock"
  | "insufficient_credits";

export type PurchaseResult =
  | { ok: true; newBalance: number; featuredUntil: Date | null }
  | { ok: false; error: PurchaseError };

/**
 * Charges Credits for one item, atomically. Two locks, for two different
 * races: `pg_advisory_xact_lock` keyed on the buyer serializes this user's
 * purchases against each other regardless of item (a stored balance would
 * have a row to lock; a derived-from-ledger balance doesn't, so two
 * concurrent purchases of two *different* items could otherwise both read
 * the same pre-commit balance and both pass the affordability check). The
 * item row's own `for("update")` separately serializes concurrent buyers of
 * the *same* capped item against each other's stock check. Both locks are
 * transaction-scoped and release automatically on commit/rollback.
 */
export async function purchaseItem(params: {
  userId: string;
  itemId: string;
}): Promise<PurchaseResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${params.userId})::bigint)`);

    const [item] = await tx
      .select()
      .from(shopItems)
      .where(eq(shopItems.id, params.itemId))
      .for("update");
    if (!item) return { ok: false, error: "item_not_found" };
    if (!item.active) return { ok: false, error: "item_inactive" };

    if (!item.repeatable) {
      const [existing] = await tx
        .select({ id: shopPurchases.id })
        .from(shopPurchases)
        .where(and(eq(shopPurchases.userId, params.userId), eq(shopPurchases.itemId, item.id)))
        .limit(1);
      if (existing) return { ok: false, error: "already_owned" };
    }

    if (item.stock !== null) {
      const [row] = await tx
        .select({ n: count() })
        .from(shopPurchases)
        .where(eq(shopPurchases.itemId, item.id));
      if (Number(row?.n ?? 0) >= item.stock) return { ok: false, error: "out_of_stock" };
    }

    const balance = await getCreditsBalance(tx, params.userId);
    if (balance < item.price) return { ok: false, error: "insufficient_credits" };

    const featuredUntil =
      item.category === "activity_feature" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

    await tx.insert(shopPurchases).values({ userId: params.userId, itemId: item.id, featuredUntil });
    await tx.insert(creditTransactions).values({
      userId: params.userId,
      amount: -item.price,
      reason: "shop_purchase",
      note: `shop: ${item.slug}`,
    });

    return { ok: true, newBalance: balance - item.price, featuredUntil };
  });
}

export type EquipError = "item_not_found" | "not_owned" | "not_equippable";
export type EquipResult = { ok: true } | { ok: false; error: EquipError };

// Free and instant on purpose (no confirm dialog, no transaction) — equipping
// something you already own is reversible and costs nothing, unlike buying.
export async function equipItem(params: { userId: string; itemId: string }): Promise<EquipResult> {
  const item = await db.query.shopItems.findFirst({ where: eq(shopItems.id, params.itemId) });
  if (!item) return { ok: false, error: "item_not_found" };
  if (item.category !== "flair" && item.category !== "title") {
    return { ok: false, error: "not_equippable" };
  }

  const [owned] = await db
    .select({ id: shopPurchases.id })
    .from(shopPurchases)
    .where(and(eq(shopPurchases.userId, params.userId), eq(shopPurchases.itemId, item.id)))
    .limit(1);
  if (!owned) return { ok: false, error: "not_owned" };

  await db
    .insert(equippedCosmetics)
    .values({ userId: params.userId, category: item.category, itemId: item.id })
    .onConflictDoUpdate({
      target: [equippedCosmetics.userId, equippedCosmetics.category],
      set: { itemId: item.id },
    });

  return { ok: true };
}

export type EquippedNames = { title: string | null; flairGlyph: string | null };

// Batched lookup for surfaces rendering many users at once (the leaderboard)
// — one query for everyone's equipped title/flair rather than N. `userIds`
// is optional: the leaderboard doesn't have its user-id list until its own
// user query resolves, so omitting the filter lets this run inside the same
// Promise.all as that query instead of waiting on its result first — the
// equipped_cosmetics table is small (one row per user per category) either
// way, so scanning it unfiltered costs nothing extra.
export async function getEquippedForUsers(userIds?: string[]): Promise<Map<string, EquippedNames>> {
  if (userIds && userIds.length === 0) return new Map();

  const rows = await db
    .select({
      userId: equippedCosmetics.userId,
      category: equippedCosmetics.category,
      name: shopItems.name,
      flairGlyph: shopItems.flairGlyph,
    })
    .from(equippedCosmetics)
    .innerJoin(shopItems, eq(equippedCosmetics.itemId, shopItems.id))
    .where(userIds ? inArray(equippedCosmetics.userId, userIds) : undefined);

  const byUser = new Map<string, EquippedNames>();
  for (const row of rows) {
    const entry = byUser.get(row.userId) ?? { title: null, flairGlyph: null };
    if (row.category === "title") entry.title = row.name;
    if (row.category === "flair") entry.flairGlyph = row.flairGlyph;
    byUser.set(row.userId, entry);
  }
  return byUser;
}

// Matches on user.name against the raw webhook `pusher` string, the same
// loose identity link the rest of the activity feed relies on (there's no
// stronger tie between a Forgejo git-push actor and a Better Auth session at
// this layer) — good enough at 14 trusted users, not a general-purpose join.
export async function getActiveFeaturedNames(): Promise<Set<string>> {
  const rows = await db
    .select({ name: user.name })
    .from(shopPurchases)
    .innerJoin(user, eq(shopPurchases.userId, user.id))
    .where(gt(shopPurchases.featuredUntil, new Date()));
  return new Set(rows.map((r) => r.name));
}
