import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "./exec";
import type { RunnerContext, DockerfileCheckVerdict } from "./types";

// See infra/sandbox-dockerfile-check/README.md for the full PoC writeup
// (nine fixture-validated boundaries, six real bugs found before this was
// trusted). No custom Dockerfile/judge image for this runner, unlike
// sandbox-exec/io-match/git-assert: Kaniko, hadolint, and skopeo are all
// upstream images doing exactly what's needed, so there is nothing of our
// own to bundle into a container. The assertion evaluation below runs
// directly in Node against already-extracted metadata, not against
// anything the submitter wrote, so it doesn't need its own sandbox.
const KANIKO_IMAGE = process.env.DOCKERFILE_CHECK_KANIKO_IMAGE ?? "gcr.io/kaniko-project/executor:v1.23.2";
const HADOLINT_IMAGE = process.env.DOCKERFILE_CHECK_HADOLINT_IMAGE ?? "hadolint/hadolint:2.12.0";
// Matches the compose service in infra/docker-compose.yml — the proxy is
// the only thing with a route off DOCKERFILE_CHECK_NETWORK, which has no
// WAN route of its own (see the PoC README for why that ordering, not the
// proxy env vars, is the actual containment guarantee).
const PROXY_URL = process.env.DOCKERFILE_CHECK_PROXY_URL ?? "http://dockerfile-check-proxy:3128";
const INTERNAL_NETWORK = process.env.DOCKERFILE_CHECK_NETWORK ?? "dockerfile-check-internal";
const BUILD_TIMEOUT_MS = 90_000;
const HADOLINT_TIMEOUT_MS = 15_000;
const CONFIG_EXTRACT_TIMEOUT_MS = 10_000;
const MEMORY_CAP = "512m";
const CPU_CAP = "2";
const PIDS_CAP = "256";

type DockerfileAssertion =
  | { type: "builds-successfully" }
  | { type: "runs-as-non-root" }
  | { type: "no-latest-tag" }
  | { type: "image-size-under"; megabytes: number }
  | { type: "hadolint-clean" }
  | { type: "has-healthcheck" };

type DockerfileCheckSpec = { assertions: DockerfileAssertion[] };

function isDockerfileCheckSpec(spec: unknown): spec is DockerfileCheckSpec {
  return !!spec && typeof spec === "object" && Array.isArray((spec as DockerfileCheckSpec).assertions);
}

function failedVerdict(error: string): DockerfileCheckVerdict {
  return {
    runner: "dockerfile-check",
    ran: false,
    tests_passed: false,
    checks: [],
    duration_ms: 0,
    verdict: "failed",
    error,
  };
}

type HadolintFinding = { code: string; level: string; message: string; line: number };

async function runHadolint(dockerfilePath: string): Promise<HadolintFinding[]> {
  const { stdout, code } = await run(
    "docker",
    ["run", "--rm", "-v", `${dockerfilePath}:/Dockerfile:ro`, HADOLINT_IMAGE, "hadolint", "-f", "json", "/Dockerfile"],
    HADOLINT_TIMEOUT_MS,
  );
  // hadolint exits non-zero when it finds anything, so a non-zero code
  // here is expected, not a failure to run it — only empty/unparseable
  // stdout means the tool itself didn't run.
  if (code === null) throw new Error(`hadolint timed out after ${HADOLINT_TIMEOUT_MS}ms`);
  try {
    return JSON.parse(stdout || "[]");
  } catch {
    throw new Error(`hadolint produced non-JSON output: ${stdout}`);
  }
}

type ImageConfig = { User?: string; Healthcheck?: unknown };

async function buildWithKaniko(extractDir: string, outputDir: string, tarPath: string) {
  const buildArgs = [
    "run",
    "--rm",
    "--network",
    INTERNAL_NETWORK,
    "--memory",
    MEMORY_CAP,
    "--cpus",
    CPU_CAP,
    "--pids-limit",
    PIDS_CAP,
    "-e",
    `HTTPS_PROXY=${PROXY_URL}`,
    "-e",
    `HTTP_PROXY=${PROXY_URL}`,
    "-v",
    `${extractDir}:/workspace:ro`,
    "-v",
    `${outputDir}:/output`,
    KANIKO_IMAGE,
    "--dockerfile=/workspace/Dockerfile",
    "--context=dir:///workspace",
    "--no-push",
    "--tarPath=/output/image.tar",
    "--destination=dockerfile-check/submission:latest",
    // Kaniko does not forward the outer container's own -e env vars into
    // RUN steps at all (confirmed directly against a `RUN env` fixture in
    // the PoC) — only Docker's "predefined ARGs" convention reaches them.
    // The -e flags above are for Kaniko's own registry client, which
    // reads process env directly; both are required, neither is enough
    // alone.
    `--build-arg=http_proxy=${PROXY_URL}`,
    `--build-arg=https_proxy=${PROXY_URL}`,
    `--build-arg=HTTP_PROXY=${PROXY_URL}`,
    `--build-arg=HTTPS_PROXY=${PROXY_URL}`,
  ];

  const result = await run("docker", buildArgs, BUILD_TIMEOUT_MS);
  if (result.code === null) throw new Error(`kaniko build timed out after ${BUILD_TIMEOUT_MS}ms`);
  return { succeeded: result.code === 0, stderr: result.stderr, stdout: result.stdout, tarPath };
}

// `skopeo inspect --config` was tried first, but verified directly (not
// assumed) to silently drop the `Healthcheck` field even when one is
// genuinely present in the image: a real Dockerfile with a HEALTHCHECK
// instruction produced a config with no `Healthcheck` key at all in
// skopeo's output, while the *raw* OCI config blob (extracted straight
// from the tarball's manifest.json -> Config digest -> that file) had it
// correctly. Reading the raw config directly avoids depending on
// whichever subset of fields skopeo's own output format happens to
// surface, and drops a whole extra image dependency in the process.
async function readImageConfig(tarPath: string): Promise<ImageConfig | null> {
  const extractDir = await mkdtemp(path.join(tmpdir(), "oci-config-"));
  try {
    const manifestExtract = await run("tar", ["-xf", tarPath, "-C", extractDir, "manifest.json"], CONFIG_EXTRACT_TIMEOUT_MS);
    if (manifestExtract.code !== 0) return null;
    const manifest = JSON.parse(await readFile(path.join(extractDir, "manifest.json"), "utf8"));
    const configDigest: string | undefined = manifest[0]?.Config;
    if (!configDigest) return null;

    const configExtract = await run("tar", ["-xf", tarPath, "-C", extractDir, configDigest], CONFIG_EXTRACT_TIMEOUT_MS);
    if (configExtract.code !== 0) return null;
    const configJson = JSON.parse(await readFile(path.join(extractDir, configDigest), "utf8"));
    return configJson.config ?? null;
  } catch {
    return null;
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
}

export async function runDockerfileCheck(ctx: RunnerContext): Promise<DockerfileCheckVerdict> {
  if (!isDockerfileCheckSpec(ctx.spec)) {
    return failedVerdict("quest is missing a valid dockerfile-check runnerSpec (assertions array)");
  }

  const dockerfilePath = path.join(ctx.extractDir, "Dockerfile");
  let dockerfileText: string;
  try {
    dockerfileText = await readFile(dockerfilePath, "utf8");
  } catch {
    return failedVerdict("no Dockerfile found at the root of the submission");
  }

  const startMs = Date.now();
  const outputDir = path.join(ctx.extractDir, "..", "kaniko-output");
  await mkdir(outputDir, { recursive: true });
  const tarPath = path.join(outputDir, "image.tar");

  const [build, hadolintFindings] = await Promise.all([
    buildWithKaniko(ctx.extractDir, outputDir, tarPath),
    runHadolint(dockerfilePath),
  ]);

  let imageConfig: ImageConfig | null = null;
  let imageBytes: number | null = null;
  if (build.succeeded) {
    imageConfig = await readImageConfig(tarPath);
    try {
      imageBytes = (await stat(tarPath)).size;
    } catch {
      imageBytes = null;
    }
  }

  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
  let allPassed = true;
  const addCheck = (name: string, passed: boolean, detail: string) => {
    checks.push({ name, passed, detail });
    if (!passed) allPassed = false;
  };

  for (const assertion of ctx.spec.assertions) {
    switch (assertion.type) {
      case "builds-successfully":
        addCheck(
          "builds-successfully",
          build.succeeded,
          build.succeeded ? "image built cleanly" : `build failed: ${build.stderr.slice(-500) || build.stdout.slice(-500)}`,
        );
        break;

      case "runs-as-non-root": {
        if (!build.succeeded) {
          addCheck("runs-as-non-root", false, "cannot inspect image, build failed");
          break;
        }
        const user = imageConfig?.User;
        const passed = !!user && user.trim() !== "" && user.trim() !== "0" && user.trim() !== "root";
        addCheck("runs-as-non-root", passed, passed ? `runs as USER ${user}` : "no USER directive set, image runs as root");
        break;
      }

      case "no-latest-tag": {
        const fromLines = dockerfileText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => /^FROM\s+/i.test(l));
        const unpinned = fromLines.filter((l) => {
          const ref = l.replace(/^FROM\s+/i, "").split(/\s+/)[0];
          return ref.endsWith(":latest") || !ref.includes(":");
        });
        addCheck(
          "no-latest-tag",
          unpinned.length === 0,
          unpinned.length === 0 ? "every FROM line pins a real tag" : `unpinned base image(s): ${unpinned.join(", ")}`,
        );
        break;
      }

      case "image-size-under": {
        if (!build.succeeded || imageBytes === null) {
          addCheck("image-size-under", false, "cannot measure image size, build failed");
          break;
        }
        const actualMb = imageBytes / (1024 * 1024);
        const passed = actualMb <= assertion.megabytes;
        addCheck(
          "image-size-under",
          passed,
          `image is ${actualMb.toFixed(1)}MB (limit ${assertion.megabytes}MB)`,
        );
        break;
      }

      case "hadolint-clean":
        addCheck(
          "hadolint-clean",
          hadolintFindings.length === 0,
          hadolintFindings.length === 0
            ? "no hadolint findings"
            : hadolintFindings.map((f) => `${f.code} (line ${f.line}): ${f.message}`).join("; "),
        );
        break;

      case "has-healthcheck": {
        if (!build.succeeded) {
          addCheck("has-healthcheck", false, "cannot inspect image, build failed");
          break;
        }
        const passed = !!imageConfig?.Healthcheck;
        addCheck("has-healthcheck", passed, passed ? "HEALTHCHECK is set" : "no HEALTHCHECK instruction found");
        break;
      }
    }
  }

  const durationMs = Date.now() - startMs;
  return {
    runner: "dockerfile-check",
    ran: true,
    tests_passed: allPassed,
    checks,
    duration_ms: durationMs,
    verdict: allPassed ? "violet" : "failed",
  };
}
