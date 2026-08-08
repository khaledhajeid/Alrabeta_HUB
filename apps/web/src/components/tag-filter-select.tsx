"use client";

import { useRouter } from "next/navigation";

// Phase 7.5.G: 10 pills for a 4-quest catalog was a real working-memory
// violation (Cowan's revised Miller's Law caps comfortable simultaneous
// options at ~4) — a native <select> doesn't show every option at once by
// construction, and gets keyboard/screen-reader support for free instead
// of a hand-built combobox under time pressure.
export function TagFilterSelect({ tags, current }: { tags: string[]; current?: string }) {
  const router = useRouter();

  return (
    <select
      value={current ?? ""}
      onChange={(e) => {
        router.push(e.target.value ? `/quests?tag=${encodeURIComponent(e.target.value)}` : "/quests");
      }}
      aria-label="Filter quests by tag"
      className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm text-text transition-colors duration-(--motion-fast) ease-(--ease-out-quint) hover:border-text-muted focus-visible:outline-2 focus-visible:outline-accent"
    >
      <option value="">All tags</option>
      {tags.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
