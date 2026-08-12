// Same stroke-icon language as FlameIcon/TokenIcon in profile/page.tsx (2px
// stroke, rounded caps, no fill) — flair is rendered as one of these, never
// literal emoji or arbitrary unicode, so an equipped flair reads as part of
// this system's icon set rather than a foreign glyph dropped next to a name.
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
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
    </svg>
  );
}

function CometIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      aria-hidden
      {...props}
    >
      <circle cx="17" cy="7" r="2.5" fill="currentColor" stroke="none" />
      <path d="M14.5 9.5 6 18" strokeWidth="2" />
      <path d="M12.5 11.5 8.5 15.5" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

function PrismIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12 3 21 19H3Z" />
      <path d="M12 3v16" opacity="0.5" />
    </svg>
  );
}

const FLAIR_ICONS: Record<string, (props: React.SVGProps<SVGSVGElement>) => React.ReactElement> = {
  spark: SparkIcon,
  comet: CometIcon,
  prism: PrismIcon,
};

export function FlairIcon({
  glyph,
  className,
}: {
  glyph: string;
  className?: string;
}) {
  const Icon = FLAIR_ICONS[glyph] ?? SparkIcon;
  return <Icon className={className} />;
}
