import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { run } from "./exec";
import type { IoMatchVerdict, RunnerContext } from "./types";

const IO_MATCH_IMAGE = process.env.IO_MATCH_IMAGE ?? "alrabeta-io-match:latest";
const DOCKER_RUN_TIMEOUT_MS = 60_000;

type IoMatchCase = {
  name?: string;
  stdin?: string;
  args?: string[];
  expected_stdout: string;
};

type IoMatchSpec = {
  entryFile: string; // e.g. "solution.sh" — the file the submitter is expected to create
  cases: IoMatchCase[];
};

function isIoMatchSpec(spec: unknown): spec is IoMatchSpec {
  return (
    !!spec &&
    typeof spec === "object" &&
    typeof (spec as IoMatchSpec).entryFile === "string" &&
    Array.isArray((spec as IoMatchSpec).cases)
  );
}

function failedVerdict(error: string): IoMatchVerdict {
  return { runner: "io-match", ran: false, tests_passed: false, cases: [], duration_ms: 0, verdict: "failed", error };
}

/**
 * Grades a submitted script against stdin→stdout test cases, in the same
 * hardened-container spirit as sandbox-exec but against a different image
 * (infra/sandbox-io-match) — see that image's README for why it doesn't
 * need sandbox-exec's seccomp override or SYS_PTRACE capability.
 */
export async function runIoMatch(ctx: RunnerContext): Promise<IoMatchVerdict> {
  if (!isIoMatchSpec(ctx.spec)) {
    return failedVerdict("quest is missing a valid io-match runnerSpec (entryFile + cases)");
  }

  const scriptPath = path.join(ctx.extractDir, ctx.spec.entryFile);
  try {
    await stat(scriptPath);
  } catch {
    return failedVerdict(`submission is missing ${ctx.spec.entryFile}`);
  }

  const casesPath = path.join(ctx.extractDir, ".runner-cases.json");
  await writeFile(casesPath, JSON.stringify(ctx.spec.cases));

  const ext = path.extname(ctx.spec.entryFile);
  const containerScriptPath = `/work/solution${ext}`;
  const containerCasesPath = "/work/cases.json";

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
    "-v",
    `${scriptPath}:${containerScriptPath}:ro`,
    "-v",
    `${casesPath}:${containerCasesPath}:ro`,
    IO_MATCH_IMAGE,
    containerScriptPath,
    containerCasesPath,
  ];

  const { stdout, stderr, code } = await run("docker", dockerArgs, DOCKER_RUN_TIMEOUT_MS);
  if (code === null) {
    throw new Error(`docker run timed out after ${DOCKER_RUN_TIMEOUT_MS}ms`);
  }

  try {
    const parsed = JSON.parse(stdout);
    return { runner: "io-match", ...parsed };
  } catch {
    throw new Error(`runner.sh produced non-JSON output (exit ${code}): ${stderr || stdout}`);
  }
}
