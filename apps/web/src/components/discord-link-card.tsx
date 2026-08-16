"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TierIcon } from "./gamification-icons";

export function DiscordLinkCard({ linkedId }: { linkedId: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/discord-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ discordUserId: value.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.error === "already_linked"
            ? "That Discord account is already linked to someone else"
            : "That doesn't look like a Discord user ID",
        );
        return;
      }
      setValue("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  async function unlink() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/discord-link", { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't unlink — try again");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg bg-surface p-5 shadow-resting">
      <h2 className="text-sm font-medium text-text-muted">Discord</h2>

      {linkedId ? (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <TierIcon className="h-8 w-8 shrink-0 text-accent" />
              <div>
                <div className="text-sm font-medium text-text">Linked</div>
                <div className="font-mono text-xs text-text-muted">{linkedId}</div>
              </div>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={unlink}
              className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-text-muted transition-[color,background-color,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:bg-surface-2 hover:text-text active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {pending ? "Unlinking…" : "Unlink"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-text-muted">
            Link your Discord ID to get a server role automatically as your points climb. Enable
            Developer Mode (User Settings &rarr; Advanced), then right-click your name and{" "}
            <span className="text-text">Copy User ID</span>.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 123456789012345678"
              className="min-w-0 flex-1 rounded-md border border-line bg-ink px-3 py-1.5 font-mono text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="button"
              disabled={pending || value.trim().length === 0}
              onClick={link}
              className="shrink-0 rounded-md bg-accent-strong px-3 py-1.5 text-xs font-medium text-accent-ink transition-[background-color,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:hover:brightness-100 disabled:active:scale-100"
            >
              {pending ? "Linking…" : "Link"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
