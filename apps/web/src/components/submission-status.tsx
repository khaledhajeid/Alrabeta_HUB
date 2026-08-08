// Phase 7.5.F: the actual fix for the audit's biggest single finding — a
// quest result used to be a 14px text row, visually identical in weight to
// a timestamp. This is the one place the reward for solving something hard
// needs to land. Tone stays quiet and confident (color + icon + the
// existing reveal-list entrance), not a confetti burst — Vercel/Linear/
// Raycast restraint, same register the rest of this redesign committed to.
// Status colors reuse --signal/--danger deliberately, not --accent — this
// is state, not brand identity, same distinction DESIGN.md already draws
// for the service-status dots.

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

const STATUS_INFO: Record<string, { label: string; className: string; Icon: typeof CheckIcon }> = {
  passed: { label: "Passed", className: "text-signal", Icon: CheckIcon },
  failed: { label: "Failed", className: "text-danger", Icon: XIcon },
  submitted: { label: "Grading…", className: "text-text-muted", Icon: ClockIcon },
  needs_review: { label: "Needs review", className: "text-text-muted", Icon: ClockIcon },
};

export function SubmissionStatus({ status }: { status: string }) {
  const info = STATUS_INFO[status] ?? { label: status, className: "text-text-muted", Icon: ClockIcon };
  const { Icon } = info;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${info.className}`}>
      <Icon width="15" height="15" />
      {info.label}
    </span>
  );
}
