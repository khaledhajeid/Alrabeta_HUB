import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// infra/sandbox lives outside apps/web, but the judge image and its seccomp
// profile are the same artifacts infra/sandbox/README.md documents and
// validates against fixtures/{clean,leaky,racy}.c — this must stay pointed
// at that exact profile, not a copy, so the two can't drift.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../../../../");
const SECCOMP_PATH = path.join(REPO_ROOT, "infra/sandbox/judge-seccomp.json");

const JUDGE_IMAGE = process.env.JUDGE_IMAGE ?? "alrabeta-judge:latest";

// Wall-clock ceiling for the whole `docker run`, on top of judge.sh's own
// internal per-stage timeouts (5s/10s/10s/30s). This is the backstop for
// Docker itself hanging (image pull stall, daemon under load) — judge.sh
// finishing late is already impossible by construction, this covers it not
// finishing at all.
const DOCKER_RUN_TIMEOUT_MS = 90_000;

const GRADABLE_FILENAMES = ["solution.c", "solution.cpp"];

export type JudgeVerdict = {
  compiled: boolean;
  exit_code: number;
  tests_passed: boolean;
  valgrind: { leaked_bytes: number; errors: number; clean: boolean };
  asan_ubsan: { clean: boolean; findings: string[] };
  tsan: { clean: boolean; races: number; skipped: boolean; crashed: boolean };
  duration_ms: number;
  verdict: "violet" | "clean" | "failed";
};

function noGradableFileVerdict(): JudgeVerdict {
  return {
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

async function downloadArchive(params: {
  ownerLogin: string;
  repoName: string;
  commitSha: string;
  destPath: string;
}) {
  const url = `${process.env.FORGEJO_URL}/api/v1/repos/${params.ownerLogin}/${params.repoName}/archive/${params.commitSha}.tar.gz`;

  const res = await fetch(url, {
    headers: { Authorization: `token ${process.env.FORGEJO_API_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Forgejo API ${res.status} fetching archive for ${params.ownerLogin}/${params.repoName}@${params.commitSha}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(params.destPath, buf);
}

function run(cmd: string, args: string[], timeoutMs?: number): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { timeout: timeoutMs });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
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
 * Fetches a submission's code from Forgejo and runs it through the judge
 * image with the exact hardened flag set validated in
 * infra/sandbox/README.md (network none, resource caps, read-only root +
 * exec tmpfs, seccomp profile). Never throws for a submission-side problem
 * (bad code, no gradable file, compile failure) — those all resolve to a
 * JudgeVerdict with verdict "failed" so the caller can persist a result
 * either way. Throws only for infra failures (Forgejo unreachable, docker
 * missing) that a retry might fix.
 */
export async function judgeSubmission(params: {
  ownerLogin: string;
  repoName: string;
  commitSha: string;
}): Promise<JudgeVerdict> {
  const workDir = await mkdtemp(path.join(tmpdir(), "judge-"));
  try {
    const archivePath = path.join(workDir, "source.tar.gz");
    await downloadArchive({ ...params, destPath: archivePath });

    const extractDir = path.join(workDir, "src");
    await mkdir(extractDir);
    // Forgejo's archive has a single top-level "<repo>-<sha>/" dir wrapping
    // everything; --strip-components=1 flattens straight to repo contents.
    const extract = await run("tar", ["-xzf", archivePath, "-C", extractDir, "--strip-components=1"]);
    if (extract.code !== 0) {
      throw new Error(`tar extraction failed: ${extract.stderr}`);
    }

    const sourceFile = await findGradableFile(extractDir);
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
      return JSON.parse(stdout) as JudgeVerdict;
    } catch {
      throw new Error(`judge.sh produced non-JSON output (exit ${code}): ${stderr || stdout}`);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
