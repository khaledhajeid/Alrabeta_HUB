import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "./runners/exec";
import { runSandboxExec } from "./runners/sandbox-exec";
import { runIoMatch } from "./runners/io-match";
import { runGitAssert } from "./runners/git-assert";
import { runDockerfileCheck } from "./runners/dockerfile-check";
import type { JudgeVerdict, RunnerContext } from "./runners/types";

export type { JudgeVerdict } from "./runners/types";

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

const GIT_CLONE_TIMEOUT_MS = 30_000;

/**
 * Full clone (all branches, full history) — git-assert's assertions need
 * real commit ancestry, which a tarball snapshot can't provide. Runs on
 * the host, not inside a sandbox: this is a fetch from Forgejo (a trusted
 * host, same trust level as downloadArchive's fetch() above), not
 * execution of anything the submitter wrote. The token never appears in
 * argv (visible via `ps aux` on the host) — a credential-helper shell
 * function reads it from an env var at invocation time instead of it
 * being embedded in the clone URL or a `-c` flag value.
 */
async function cloneRepo(params: { ownerLogin: string; repoName: string; destPath: string }) {
  const url = `${process.env.FORGEJO_URL}/${params.ownerLogin}/${params.repoName}.git`;
  const credentialHelper = `!f() { echo "username=token"; echo "password=$GIT_ASSERT_TOKEN"; }; f`;

  const { code, stderr } = await run(
    "git",
    ["-c", `credential.helper=${credentialHelper}`, "clone", "--no-single-branch", "--quiet", url, params.destPath],
    GIT_CLONE_TIMEOUT_MS,
    { env: { ...process.env, GIT_ASSERT_TOKEN: process.env.FORGEJO_API_TOKEN ?? "" } },
  );
  if (code !== 0) {
    throw new Error(`git clone failed for ${params.ownerLogin}/${params.repoName}: ${stderr}`);
  }
}

/**
 * Fetches a submission's code from Forgejo and dispatches it to the
 * matching runner (see src/server/runners/). The fetch/extract step is
 * shared across runner types deliberately — sandbox-exec, io-match, and
 * dockerfile-check only ever need a file snapshot at one commit, so
 * there's one shared code path here rather than each runner
 * re-implementing archive handling. git-assert is the one exception:
 * assertions like "no merge commits" need real git history, not a tarball
 * snapshot, so it gets its own branch below (a real `git clone`) instead
 * of the shared archive-download path.
 *
 * Never throws for a submission-side problem (bad code, no gradable file,
 * compile/test failure) — those all resolve to a JudgeVerdict with verdict
 * "failed" so the caller can persist a result either way. Throws only for
 * infra failures (Forgejo unreachable, docker missing, an unimplemented
 * runner) that a retry might fix or that shouldn't silently grade as failed.
 */
export async function judgeSubmission(params: {
  ownerLogin: string;
  repoName: string;
  commitSha: string;
  runner: "sandbox-exec" | "io-match" | "dockerfile-check" | "git-assert";
  runnerSpec: unknown;
}): Promise<JudgeVerdict> {
  const workDir = await mkdtemp(path.join(tmpdir(), "judge-"));
  try {
    if (params.runner === "git-assert") {
      const repoDir = path.join(workDir, "repo");
      await cloneRepo({ ownerLogin: params.ownerLogin, repoName: params.repoName, destPath: repoDir });
      return await runGitAssert({ repoDir, commitSha: params.commitSha, spec: params.runnerSpec });
    }

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

    const ctx: RunnerContext = { extractDir, spec: params.runnerSpec };

    switch (params.runner) {
      case "sandbox-exec":
        return await runSandboxExec(ctx);
      case "io-match":
        return await runIoMatch(ctx);
      case "dockerfile-check":
        return await runDockerfileCheck(ctx);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
