// A runner is handed an already-fetched, already-extracted submission tree
// (judge.ts owns the fetch/extract step — see judge.ts's module comment for
// why that's shared across runner types rather than duplicated) plus the
// quest's runnerSpec, and returns a verdict shaped for its own grading
// strategy. JudgeVerdict is a discriminated union on `runner` so a caller
// (badges.ts, judge-worker.ts) narrows to the fields that actually exist
// for that runner rather than every verdict being forced to carry every
// runner type's fields.

export type RunnerContext = {
  extractDir: string;
  spec: unknown;
};

// git-assert is the one exception to the shared fetch/extract contract
// above — it needs real commit history, not a tarball snapshot, so
// judge.ts hands it a different shape entirely: a full clone (with its
// .git intact) plus the commit sha, rather than an extracted file tree.
export type GitAssertContext = {
  repoDir: string;
  commitSha: string;
  spec: unknown;
};

export type SandboxExecVerdict = {
  runner: "sandbox-exec";
  compiled: boolean;
  exit_code: number;
  tests_passed: boolean;
  valgrind: { leaked_bytes: number; errors: number; clean: boolean };
  asan_ubsan: { clean: boolean; findings: string[] };
  tsan: { clean: boolean; races: number; skipped: boolean; crashed: boolean };
  duration_ms: number;
  verdict: "violet" | "clean" | "failed";
};

export type IoMatchVerdict = {
  runner: "io-match";
  ran: boolean;
  tests_passed: boolean;
  cases: Array<{
    name: string;
    passed: boolean;
    expected_stdout: string;
    actual_stdout: string;
    exit_code: number;
  }>;
  duration_ms: number;
  // No "clean" state here — io-match has no sanitizer dimension, a
  // submission either passes every case or it doesn't.
  verdict: "violet" | "failed";
  error?: string;
};

export type GitAssertVerdict = {
  runner: "git-assert";
  ran: boolean;
  tests_passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  duration_ms: number;
  verdict: "violet" | "failed";
  error?: string;
};

export type JudgeVerdict = SandboxExecVerdict | IoMatchVerdict | GitAssertVerdict;
