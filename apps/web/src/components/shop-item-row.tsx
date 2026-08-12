"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FlairIcon } from "./shop-icons";

type Item = {
  id: string;
  name: string;
  description: string;
  category: "flair" | "title" | "activity_feature" | "real_world_reward";
  price: number;
  flairGlyph: string | null;
  repeatable: boolean;
  remaining: number | null;
};

const REDEEMED_COPY: Record<string, string> = {
  activity_feature: "Featured for the next 24 hours.",
  real_world_reward: "Redeemed — an admin will follow up.",
};

export function ShopItemRow({
  item,
  balance,
  owned,
  equipped,
  activeUntilLabel,
}: {
  item: Item;
  balance: number;
  owned: boolean;
  equipped: boolean;
  // Precomputed server-side (shop/page.tsx), not a raw timestamp for this
  // component to compare against its own clock — React's purity rules
  // disallow calling Date.now() during a client component's render, and
  // the server already knows "now" exactly once per request. Only ever
  // set for category "activity_feature", when the buyer already has an
  // unexpired Spotlight window; a repurchase replaces that window rather
  // than extending it (see purchaseItem in shop.ts), so this exists to
  // stop someone from double-spending on a boost that's already running,
  // not to gate the button.
  activeUntilLabel?: string | null;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);

  const canAfford = balance >= item.price;
  const soldOut = item.remaining !== null && item.remaining <= 0;
  const equippable = item.category === "flair" || item.category === "title";

  async function equip() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/equip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (!res.ok) {
        setError("Couldn't equip that — try again");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  async function confirmPurchase() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.error === "out_of_stock"
            ? "Someone else claimed the last one"
            : body?.error === "already_owned"
              ? "You already own this"
              : body?.error === "insufficient_credits"
                ? "Not enough Credits"
                : "Couldn't complete that purchase",
        );
        return;
      }
      dialogRef.current?.close();
      if (item.repeatable) setRedeemed(true);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {item.flairGlyph && (
        <FlairIcon glyph={item.flairGlyph} className="h-6 w-6 shrink-0 text-accent" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text">{item.name}</div>
        <p className="mt-0.5 text-xs text-text-muted">{item.description}</p>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        {redeemed && REDEEMED_COPY[item.category] && (
          <p className="mt-1 text-xs text-signal">{REDEEMED_COPY[item.category]}</p>
        )}
        {!redeemed && activeUntilLabel && (
          <p className="mt-1 text-xs text-signal">
            Already active, until {activeUntilLabel}. Buying again replaces this window rather than
            extending it.
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-mono text-xs tabular-nums text-text-muted">
          {item.price.toLocaleString("en-US")} Credits
        </span>

        {equippable && equipped ? (
          <span className="text-xs font-medium text-signal">Equipped</span>
        ) : equippable && owned ? (
          <button
            type="button"
            disabled={pending}
            onClick={equip}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-text-muted transition-[color,background-color,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:bg-surface-2 hover:text-text active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {pending ? "Equipping…" : "Equip"}
          </button>
        ) : soldOut ? (
          <span className="text-xs text-text-muted">Sold out</span>
        ) : (
          <>
            <button
              type="button"
              disabled={!canAfford}
              onClick={() => dialogRef.current?.showModal()}
              className="rounded-md bg-accent-strong px-3 py-1.5 text-xs font-medium text-accent-ink transition-[background-color,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:hover:brightness-100 disabled:active:scale-100"
            >
              Buy
            </button>
            {!canAfford && (
              <span className="text-xs text-text-muted">Need {item.price - balance} more</span>
            )}
          </>
        )}
      </div>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        onClose={() => setError(null)}
        className="m-auto max-w-sm rounded-lg border border-line bg-surface p-6 text-text shadow-raised backdrop:bg-ink/60"
      >
        <h2 className="text-sm font-semibold text-text">Buy {item.name}?</h2>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-text-muted">Price</span>
          <span className="font-mono tabular-nums text-text">
            {item.price.toLocaleString("en-US")} Credits
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 text-sm">
          <span className="text-text-muted">New balance</span>
          <span className="font-mono tabular-nums text-text">
            {(balance - item.price).toLocaleString("en-US")} Credits
          </span>
        </div>
        {error && <p className="mt-3 text-xs text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={confirmPurchase}
            className="rounded-md bg-accent-strong px-3 py-1.5 text-xs font-medium text-accent-ink transition-[background-color] hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Buying…" : "Confirm"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
