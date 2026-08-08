import { writeFile } from "node:fs/promises";
import path from "node:path";
import { run } from "./exec";
import type { GitAssertContext, GitAssertVerdict } from "./types";

const GIT_ASSERT_IMAGE = process.env.GIT_ASSERT_IMAGE ?? "alrabeta-git-assert:latest";
const DOCKER_RUN_TIMEOUT_MS = 30_000;

type GitAssertion =
  | { type: "no-merge-commits" }
  | { type: "commit-count"; op: "eq" | "min" | "max"; value: number }
  | { type: "commit-message-matches"; pattern: string };

type GitAssertSpec = {
  baseRef?: string; // defaults to "main"
  assertions: GitAssertion[];
};

function isGitAssertSpec(spec: unknown): spec is GitAssertSpec {
  return !!spec && typeof spec === "object" && Array.isArray((spec as GitAssertSpec).assertions);
}

function failedVerdict(error: string): GitAssertVerdict {
  return { runner: "git-assert", ran: false, tests_passed: false, checks: [], duration_ms: 0, verdict: "failed", error };
}

/**
 * Grades a submission by inspecting real git history (already cloned by
 * judge.ts — see that module for why git-assert needs a full clone rather
 * than the tarball snapshot the other runners use), inside the same
 * hardened-container model as sandbox-exec/io-match. The clone itself
 * needed network to fetch from Forgejo; that already happened on the host
 * before this function runs. This step never touches the network — see
 * infra/sandbox-git-assert/README.md for why that boundary matters even
 * though this runner doesn't execute anything the submitter wrote.
 */
export async function runGitAssert(ctx: GitAssertContext): Promise<GitAssertVerdict> {
  if (!isGitAssertSpec(ctx.spec)) {
    return failedVerdict("quest is missing a valid git-assert runnerSpec (assertions array)");
  }

  const specPath = path.join(path.dirname(ctx.repoDir), ".runner-spec.json");
  await writeFile(
    specPath,
    JSON.stringify({
      base_ref: ctx.spec.baseRef ?? "main",
      commit_sha: ctx.commitSha,
      assertions: ctx.spec.assertions,
    }),
  );

  const containerRepoPath = "/repo";
  const containerSpecPath = "/spec.json";

  const dockerArgs = [
    "run",
    "--rm",
    "--network",
    "none",
    "--memory",
    "256m",
    "--cpus",
    "1",
    "--pids-limit",
    "128",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,exec,size=64m,mode=1777",
    "-v",
    `${ctx.repoDir}:${containerRepoPath}:ro`,
    "-v",
    `${specPath}:${containerSpecPath}:ro`,
    GIT_ASSERT_IMAGE,
    containerRepoPath,
    containerSpecPath,
  ];

  const { stdout, stderr, code } = await run("docker", dockerArgs, DOCKER_RUN_TIMEOUT_MS);
  if (code === null) {
    throw new Error(`docker run timed out after ${DOCKER_RUN_TIMEOUT_MS}ms`);
  }

  try {
    const parsed = JSON.parse(stdout);
    return { runner: "git-assert", ...parsed };
  } catch {
    throw new Error(`runner.sh produced non-JSON output (exit ${code}): ${stderr || stdout}`);
  }
}
