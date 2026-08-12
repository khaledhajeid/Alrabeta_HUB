import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getCatalog, getUserShopState, type CatalogItem } from "@/server/shop";
import { getCredits } from "@/server/credits";
import { TokenIcon } from "@/components/gamification-icons";
import { ShopItemRow } from "@/components/shop-item-row";

// Computed here, server-side, at request time rather than passed as a raw
// timestamp for the client to compare against its own clock: React's
// purity rules disallow calling Date.now() during a client component's
// render, and the server already knows "now" exactly once per request.
function formatActiveUntilLabel(activeFeatureUntil: Date | null): string | null {
  if (!activeFeatureUntil || activeFeatureUntil.getTime() <= Date.now()) return null;
  return activeFeatureUntil.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function Section({
  title,
  description,
  items,
  balance,
  ownedItemIds,
  equippedByCategory,
  activeUntilLabel,
}: {
  title: string;
  description: string;
  items: CatalogItem[];
  balance: number;
  ownedItemIds: Set<string>;
  equippedByCategory: Partial<Record<CatalogItem["category"], { id: string }>>;
  activeUntilLabel: string | null;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-text">{title}</h2>
      <p className="mt-0.5 text-xs text-text-muted">{description}</p>
      <div className="mt-3 divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-resting">
        {items.map((item) => (
          <ShopItemRow
            key={item.id}
            item={item}
            balance={balance}
            owned={ownedItemIds.has(item.id)}
            equipped={equippedByCategory[item.category]?.id === item.id}
            activeUntilLabel={item.category === "activity_feature" ? activeUntilLabel : null}
          />
        ))}
      </div>
    </section>
  );
}

export default async function ShopPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-xl font-semibold text-text">Shop</h1>
        <div className="mt-6 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">
            Sign in with Forgejo (top right) to spend your Credits.
          </p>
        </div>
      </div>
    );
  }

  const { user } = session;
  const [catalog, credits, shopState] = await Promise.all([
    getCatalog(),
    getCredits(user.id),
    getUserShopState(user.id),
  ]);

  const cosmetics = [...catalog.flair, ...catalog.title];
  const activeUntilLabel = formatActiveUntilLabel(shopState.activeFeatureUntil);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text">Shop</h1>
        <p className="mt-1 text-sm text-text-muted">
          What your Credits are actually for.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-surface px-5 py-4 shadow-resting">
        <div className="flex items-center gap-3">
          <TokenIcon className="h-6 w-6 shrink-0 text-accent" />
          <span className="text-sm text-text-muted">Your balance</span>
        </div>
        <span className="font-mono text-lg font-semibold tabular-nums text-text">
          {credits.balance.toLocaleString("en-US")} Credits
        </span>
      </div>

      <Section
        title="Cosmetics"
        description="Owned forever once bought — equip one flair and one title at a time. Shows on your Profile and the leaderboard."
        items={cosmetics}
        balance={credits.balance}
        ownedItemIds={shopState.ownedItemIds}
        equippedByCategory={shopState.equippedByCategory}
        activeUntilLabel={activeUntilLabel}
      />

      <Section
        title="Feature"
        description="A repeatable boost, not a possession — buy it again whenever you want another day."
        items={catalog.activityFeature}
        balance={credits.balance}
        ownedItemIds={shopState.ownedItemIds}
        equippedByCategory={shopState.equippedByCategory}
        activeUntilLabel={activeUntilLabel}
      />

      <Section
        title="Real-world rewards"
        description="No code behind these — buying one just tells an admin to follow up in person."
        items={catalog.realWorldReward}
        balance={credits.balance}
        ownedItemIds={shopState.ownedItemIds}
        equippedByCategory={shopState.equippedByCategory}
        activeUntilLabel={activeUntilLabel}
      />
    </div>
  );
}
