// "systems" is the one tag that carries meaning beyond labeling — it's the
// same signal as the Violet-tier badges (systems quest + zero sanitizer
// findings + first try), rendered in the brand accent itself. Every other
// tag stays neutral so that meaning doesn't get diluted into "just another
// tag color."
export function TagPill({ tag }: { tag: string }) {
  const isSystems = tag === "systems";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
        isSystems ? "border-accent/40 text-accent" : "border-line text-text-muted"
      }`}
    >
      {tag}
    </span>
  );
}
