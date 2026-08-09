// Phase 8: the Educational/Pure distinction (docs/MASTER_PLAN.md §1.5) was a
// style enum with no visual expression of its own until now — same
// stroke-icon language as SparkIcon/CheckIcon elsewhere (2px stroke,
// rounded caps, currentColor), not a one-off icon set.
export function BookIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}

function CompassIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="m14.5 9.5-2 5-5 2 2-5 5-2Z" />
    </svg>
  );
}

const STYLE_INFO = {
  educational: { label: "primer + challenge", Icon: BookIcon },
  pure: { label: "pure challenge", Icon: CompassIcon },
} as const;

export function QuestStyleBadge({ style }: { style: "educational" | "pure" }) {
  const { label, Icon } = STYLE_INFO[style];
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-text-muted">
      <Icon width="12" height="12" />
      {label}
    </span>
  );
}
