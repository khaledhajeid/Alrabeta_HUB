// Phase 8: the Mastery Path progression stepper (docs/MASTER_PLAN.md's
// Phase 8 entry) — adapts the connecting-line/dot-node shape activity-feed.tsx
// established for "a sequence of moments" (Phase 7.5.E) to "a sequence of
// steps": same ring-ink cutout so the dot reads as a node on the line, same
// restraint (no new hues — difficulty fades via --accent border weight, the
// existing token, not a new color scale; passed/current reuse --signal and
// --accent exactly like SubmissionStatus already does for state).
//
// Number/check text always sits on bg-surface-2 or bg-signal, never on a
// low-opacity accent tint — an accent/25 fill barely shifts the page
// background, and text-ink (the theme's own bg color) went functionally
// invisible on top of it. Difficulty lives in the border instead, so the
// text color underneath never has to change with it.
function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Interleaved order means position IS difficulty tier (all easy, then all
// medium, then all hard — docs/MASTER_PLAN.md §1.5) — border weight
// increasing down the list is what makes that fade-in-difficulty visible
// instead of only implied by list order, per Phase 8's checklist.
const DIFFICULTY_BORDER: Record<string, string> = {
  easy: "border-accent/30",
  medium: "border-accent/65",
  hard: "border-accent",
};

export function PathStepDot({
  position,
  difficulty,
  passed,
  current,
  isLast,
}: {
  position: number;
  difficulty: string;
  passed: boolean;
  current: boolean;
  isLast: boolean;
}) {
  return (
    <span className="relative flex shrink-0 flex-col items-center self-stretch">
      {!isLast && <span aria-hidden className="absolute top-8 bottom-[-8px] left-1/2 w-px -translate-x-1/2 bg-line" />}
      <span
        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 font-mono text-xs font-semibold ring-4 ring-ink ${
          passed
            ? "border-signal bg-signal text-signal-ink"
            : `bg-surface-2 text-text ${DIFFICULTY_BORDER[difficulty] ?? "border-accent/30"} ${
                current ? "outline outline-2 outline-offset-2 outline-accent" : ""
              }`
        }`}
      >
        {passed ? <CheckIcon width="14" height="14" /> : position}
      </span>
      {current && <span className="sr-only">Current step</span>}
      {passed && <span className="sr-only">Completed</span>}
    </span>
  );
}
