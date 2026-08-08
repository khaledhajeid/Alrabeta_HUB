// Phase 7.5.G: no loading.tsx existed anywhere in app/ — a slow navigation
// used to just show a blank flash. Skeleton blocks, not a spinner
// (product register: "skeleton states for loading, not spinners in the
// middle of content"). animate-pulse is neutered under prefers-reduced-
// motion by the global rule in globals.css already.
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="h-6 w-40 animate-pulse rounded bg-surface-2" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
