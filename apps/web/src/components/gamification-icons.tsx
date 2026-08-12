// Same stroke-icon language as SparkIcon in badge-pill.tsx (2px stroke,
// rounded caps) — shared by Profile and the shop now that both need them,
// enough real duplication (Phase 9's Streak/Credits cards, Shop v1's
// balance strip) to be worth naming instead of redefining per file.
export function FlameIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12 2c-1.5 3-4 5-4 8.5a4 4 0 0 0 8 0c0-1-.3-2-1-3 1.5.5 3 2.5 3 5.5a6 6 0 0 1-12 0C6 8 9 5.5 12 2Z" />
    </svg>
  );
}

// A plain token (two concentric circles), not a coin-with-$-sign or a coin
// stack — keeping the "quiet and confident" register instead of a
// game-shop cliché.
export function TokenIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}
