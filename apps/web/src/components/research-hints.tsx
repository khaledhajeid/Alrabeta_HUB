function ChevronIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// Phase 8: a Pure quest's "keyword pointers for external research"
// (docs/MASTER_PLAN.md §1.5) presented behind a real progressive-disclosure
// reveal (Nielsen Norman Group's term for the pattern) — closed by default,
// one click to open — rather than inline under the prompt. Inline would
// read as "the answer is basically here"; closed-by-default keeps it an
// opt-in nudge a stuck solver reaches for, not a disguised tutorial handed
// to everyone up front. A native <details> gets the disclosure semantics
// (keyboard toggle, no JS, screen-reader state) for free instead of a
// hand-rolled accordion needing its own focus/ARIA work.
export function ResearchHints({ keywords }: { keywords: string[] }) {
  if (keywords.length === 0) return null;
  return (
    <details className="group mt-10 rounded-lg border border-line bg-surface p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-text-muted marker:hidden [&::-webkit-details-marker]:hidden">
        <ChevronIcon width="14" height="14" className="transition-transform duration-(--motion-fast) ease-(--ease-out-quint) group-open:rotate-90" />
        Stuck? A few things worth researching
      </summary>
      <div className="mt-3 flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <span
            key={keyword}
            className="rounded-md bg-surface-2 px-2.5 py-1 font-mono text-xs text-text-muted"
          >
            {keyword}
          </span>
        ))}
      </div>
    </details>
  );
}
