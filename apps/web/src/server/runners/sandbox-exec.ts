import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./exec";
import type { RunnerContext, SandboxExecVerdict } from "./types";

// infra/sandbox lives outside apps/web, but the judge image and its seccomp
// profile are the same artifacts infra/sandbox/README.md documents and
// validates against fixtures/{clean,leaky,racy}.c — this must stay pointed
// at that exact profile, not a copy, so the two can't drift.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../../../../../");
const SECCOMP_PATH = path.join(REPO_ROOT, "infra/sandbox/judge-seccomp.json");

const JUDGE_IMAGE = process.env.JUDGE_IMAGE ?? "alrabeta-judge:latest";

// Wall-clock ceiling for the whole `docker run`, on top of judge.sh's own
// internal per-stage timeouts (5s/10s/10s/30s). This is the backstop for
// Docker itself hanging (image pull stall, daemon under load) — judge.sh
// finishing late is already impossible by construction, this covers it not
// finishing at all.
const DOCKER_RUN_TIMEOUT_MS = 90_000;

const GRADABLE_FILENAMES = ["solution.c", "solution.cpp"];

function noGradableFileVerdict(): SandboxExecVerdict {
  return {
    runner: "sandbox-exec",
    compiled: false,
    exit_code: -1,
    tests_passed: false,
    valgrind: { leaked_bytes: 0, errors: 0, clean: true },
    asan_ubsan: { clean: true, findings: [] },
    tsan: { clean: true, races: 0, skipped: true, crashed: false },
    duration_ms: 0,
    verdict: "failed",
  };
}

async function findGradableFile(dir: string): Promise<string | null> {
  for (const name of GRADABLE_FILENAMES) {
    const candidate = path.join(dir, name);
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // not this one, try the next
    }
  }
  return null;
}

/**
 * The original Phase 5 grading flow, unchanged in behavior — runs the
 * judge image with the exact hardened flag set validated in
 * infra/sandbox/README.md (network none, resource caps, read-only root +
 * exec tmpfs, seccomp profile).
 */
export async function runSandboxExec(ctx: RunnerContext): Promise<SandboxExecVerdict> {
  const sourceFile = await findGradableFile(ctx.extractDir);
  if (!sourceFile) return noGradableFileVerdict();

  const ext = path.extname(sourceFile);
  const containerSourcePath = `/work/solution${ext}`;

  const dockerArgs = [
    "run",
    "--rm",
    "--network",
    "none",
    "--memory",
    "512m",
    "--cpus",
    "1",
    "--pids-limit",
    "128",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,exec,size=64m,mode=1777",
    "--cap-add",
    "SYS_PTRACE",
    "--security-opt",
    `seccomp=${SECCOMP_PATH}`,
    "-v",
    `${sourceFile}:${containerSourcePath}:ro`,
    JUDGE_IMAGE,
    containerSourcePath,
  ];

  const { stdout, stderr, code } = await run("docker", dockerArgs, DOCKER_RUN_TIMEOUT_MS);
  if (code === null) {
    throw new Error(`docker run timed out after ${DOCKER_RUN_TIMEOUT_MS}ms`);
  }

  try {
    const parsed = JSON.parse(stdout);
    return { runner: "sandbox-exec", ...parsed };
  } catch {
    throw new Error(`judge.sh produced non-JSON output (exit ${code}): ${stderr || stdout}`);
  }
}
