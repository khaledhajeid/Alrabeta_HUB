// Phase 8.5 critique fix: track cards on /paths/[pathSlug] read as the same
// template with a swapped icon (P2 finding). The platform's own stated
// differentiator (docs/PRODUCT.md: "actually verifies what it claims to
// grade, not just diffs stdout") is real, track-specific data already in
// the schema, not decoration — surfacing it gives each track a genuine,
// substantive point of difference instead of another visual flourish.
export const RUNNER_LABEL: Record<string, string> = {
  "sandbox-exec": "graded via memory/thread sanitizers",
  "io-match": "graded via real stdin/stdout test cases",
  "dockerfile-check": "graded via built-image inspection",
  "git-assert": "graded via git history inspection",
};

// Only meaningful when every quest in the track shares one runner (true for
// every track today); a track that ever mixes runners has no single
// grading-method claim to make, so this returns undefined rather than
// picking one arbitrarily.
export function uniformRunnerLabel(runners: string[]): string | undefined {
  const unique = new Set(runners);
  if (unique.size !== 1) return undefined;
  const [runner] = unique;
  return RUNNER_LABEL[runner];
}
