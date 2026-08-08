import { BADGE_INFO } from "@/lib/badge-info";

// A spark, not a medal or a trophy emoji — the "quiet and confident" tone
// this redesign committed to (Phase 7.5.F). Same stroke-icon language as
// every other icon in the app (2px stroke, rounded caps), not a one-off.
function SparkIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
    </svg>
  );
}

export function BadgePill({ slug }: { slug: string }) {
  const info = BADGE_INFO[slug];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-xs font-medium text-accent"
      title={info?.description}
    >
      <SparkIcon width="12" height="12" />
      {info?.label ?? slug}
      {/* Phase 7.5.H re-audit: title-only tooltips are unreliable for
          screen readers and unavailable on touch entirely — a real gap
          the closing re-audit found in a component this same phase built. */}
      {info?.description && <span className="sr-only"> — {info.description}</span>}
    </span>
  );
}
