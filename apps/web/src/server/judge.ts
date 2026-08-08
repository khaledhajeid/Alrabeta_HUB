import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "./runners/exec";
import { runSandboxExec } from "./runners/sandbox-exec";
import { runIoMatch } from "./runners/io-match";
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

/**
 * Fetches a submission's code from Forgejo and dispatches it to the
 * matching runner (see src/server/runners/). The fetch/extract step is
 * shared across runner types deliberately — sandbox-exec, io-match, and
 * dockerfile-check (once built) only ever need a file snapshot at one
 * commit, so there's one shared code path here rather than each runner
 * re-implementing archive handling. git-assert (once built) is the
 * exception: assertions like "no merge commits" need real git history, not
 * a tarball snapshot, so it'll need its own fetch strategy (a real
 * `git clone`/`fetch`) rather than reusing this function's archive
 * download — see docs/MASTER_PLAN.md §9's Phase 7 entry.
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
      case "git-assert":
        throw new Error(`runner "${params.runner}" is not implemented yet`);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
