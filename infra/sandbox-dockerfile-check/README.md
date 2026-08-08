# dockerfile-check — PoC: containment for building untrusted Dockerfiles

Phase 7's fourth and final runner. This directory is a **standalone
security PoC**, not yet wired into `judge.ts` — the goal was to prove the
containment model holds against real adversarial input before any
integration code gets written, same discipline as every other runner in
this project (`infra/sandbox`, `infra/sandbox-io-match`,
`infra/sandbox-git-assert` all found real bugs via fixture testing before
being trusted; this one found more than any of them, because "build and
run an arbitrary Dockerfile" is a bigger attack surface than "run one
pre-known compiler on a text file").

## Why this isn't Docker-in-Docker

Grading a Dockerfile submission naively wants a nested Docker daemon
(`--privileged`, the host socket, or a rootless/Sysbox runtime) to build
and inspect the image. All three keep a daemon-shaped attack surface and,
for Sysbox, a permanent host-runtime dependency this project doesn't
otherwise need.

Instead: **Kaniko** (`gcr.io/kaniko-project/executor`) builds the image
directly, unprivileged, with no Docker daemon and no socket anywhere in
the picture — it unpacks the base image and executes each `RUN` as a real
subprocess of its own single container. There is no nested daemon to
escape from because there is no daemon. Static checks (**hadolint**) and
image-metadata extraction (**skopeo inspect**) both work off the
Dockerfile text / the built OCI tarball without ever running the produced
image — so v1 never executes the *result* of a build, only the build
process itself, which is the one thing that has to happen.

## The egress problem this creates

Every other runner in this project gets `--network none` — sandbox-exec
and io-match run pre-supplied code that never needs the network, and
git-assert only inspects an already-cloned repo. A Dockerfile build
**has** to reach the network (`FROM node:20`, `apt-get install`), so
`--network none` isn't available here. That network access is the actual
new risk this runner introduces, and it gets its own dedicated boundary:

- The build container attaches **only** to a Docker `--internal` network
  (`dockerfile-check-poc-internal`) — Docker deliberately provisions no
  WAN route for networks created this way. A `RUN` step that ignores
  every proxy env var and opens a raw socket still has nowhere to send
  the packets. This is the actual guarantee; everything below is
  convenience on top of it.
- A single-purpose **squid** proxy (`proxy/squid.conf`) straddles that
  internal network and the real bridge network, and is the *only* thing
  with a route out. It allowlists CONNECT/HTTP by destination domain —
  Docker Hub's registry + blob-storage hosts, GHCR, and Debian's package
  mirrors (this project's other three runner images all standardize on
  `debian:bookworm-slim`, so `apt-get install` needing to actually work
  is a real requirement, not a hypothetical one) — and denies everything
  else with an HTTP 403, not a silent drop.
- Kaniko's own registry fetches see the proxy via `HTTPS_PROXY`/
  `HTTP_PROXY` on the outer container. **`RUN` steps do not** — see the
  bug below.

## Bugs this PoC found (all confirmed against the real Docker/network
stack, not assumed)

**1. A wrong CDN hostname, caught by squid's own 403.** The first
allowlist guess was `production.cloudflare.docker.com` — invented from
memory. The real host Docker Hub's blob storage serves from is
`production.cloudfront.docker.com` (AWS CloudFront, not Cloudflare).
Every build failed, including the *clean* fixture, until this was
verified with a direct proxied `curl` against the real host and
corrected. Squid returning a clean 403 for the wrong-guess host is
exactly what "the deny path works" looks like — the bug was in the
allow-list content, not the enforcement mechanism.

**2. `-e` env vars on the outer container never reach `RUN` steps.**
Confirmed directly: a `RUN env | sort` fixture, run with
`HTTPS_PROXY`/`http_proxy` set via `docker run -e`, printed only
`HOME`/`PATH`/`PWD` — Kaniko does not forward its own process environment
into the subprocesses it execs for `RUN`. Kaniko's *own* registry client
(Go's `net/http`, which does read `HTTPS_PROXY` from its process env) is
unaffected — that's why the clean-fixture build still succeeded while
`apt-get install curl` inside a `RUN` step failed with a DNS error that
looked like a network problem but was actually "no proxy configured at
all." Fixed by also passing the proxy as `--build-arg http_proxy=...` /
`--build-arg https_proxy=...` (both cases) — Docker's own "predefined
ARGs" convention for proxy variables, which Kaniko honors without the
Dockerfile needing to declare `ARG http_proxy` itself. Both mechanisms are
required together; neither alone is sufficient.

**3. Busybox `wget` doesn't reliably tunnel HTTPS through an env-var
proxy.** The first egress-violation fixture used Alpine's built-in `wget`
specifically to avoid needing a package install. It failed with `wget:
bad address 'example.com'` — a DNS failure, meaning it never even
attempted the proxy, so the test wasn't actually exercising the allowlist
at all (it would have "passed" for the wrong reason). Switched to `curl`
(installed via the now-fixed, now-allowlisted Debian mirror), which
correctly reports `CONNECT tunnel failed, response 403` — real evidence
the allowlist did the denying.

**4. `skopeo inspect`'s `User` field is absent, not empty, for a
root-running image.** A first pass at the `runs-as-non-root` assertion
grepped for `"User": ""` and never matched anything, because the OCI
image-spec omits the key entirely when no `USER` was set rather than
emitting an empty string. Fixed the parser to treat *absent* the same as
*empty*, and added a second fixture (`USER app` set) to confirm the
extraction actually discriminates in both directions rather than always
reading as root.

**5. The `/dev/shm`-based memory-bomb fixture was testing the wrong
mechanism.** The first version wrote to `/dev/shm` (tmpfs) expecting to
pressure-test `--memory`; it failed with `No space left on device` —
which turned out to be Docker's own fixed 64MB default `shm-size`, a
limit that exists regardless of `--memory` and would have been identical
even with the memory cap removed entirely. Switched the fixture to write
to a regular file on the writable layer instead (`/root/bigfile`, not
tmpfs) and independently confirmed via `docker inspect .State.OOMKilled`
on a plain container that this genuinely OOM-kills under cgroups v2 —
dirty page-cache from a large sequential write counts against the
container's `--memory` limit. This resolved a real open question from
the original architecture proposal (whether `--memory` alone provides any
disk-fill protection, given `--storage-opt size=` quotas aren't portable
across storage drivers/hosts): on this stack, it does, verified rather
than assumed.

**6. `timeout`/`gtimeout` aren't installed on this dev machine.** The
harness's own wall-clock enforcement originally shelled out to
`timeout(1)`. Neither binary exists on this box. Rewritten to run the
build container detached, poll `docker inspect .State.Running`, and
force-stop directly on hitting the budget — arguably closer to the real
integration anyway, which will use Node's own `child_process` timeout
option, not a wrapping shell command.

None of these are exotic — they're the same "looks like it worked, wasn't
actually testing what it claimed to" shape as every prior bug this
project's runners have found (the git-assert `safe.directory` silent
failure, the BullMQ colon bug, the missing `jq -n`). The fix each time was
the same discipline: read the actual stderr/exit code/inspect output,
don't infer it from a clean-looking summary.

## Validated results (`./poc-test.sh`, 9/9, from a fully torn-down state)

| test | proves |
|---|---|
| clean build | a well-formed, pinned, non-root Dockerfile builds successfully through the proxy |
| egress blocked | a `RUN curl` to a non-allowlisted real host gets squid's 403 |
| egress bypass blocked | the same attempt with proxy env vars explicitly `unset` inside the `RUN` step *still* fails — for a network reason (`Could not resolve host`), not a 403 — proving the boundary is the `--internal` network's missing WAN route, not the env var a malicious step could just ignore |
| forkbomb contained | `--pids-limit` stops a classic bash fork bomb; independently reproduced outside Kaniko with a low limit to confirm the mechanism (`Cannot fork`), not just that this particular bomb happened to be harmless |
| memorybomb contained | a 4GB write to the writable layer gets OOM-killed (`exit 137`) under `--memory`, independently confirmed via `OOMKilled=true` |
| root-user metadata | `skopeo inspect --config` on a Dockerfile with no `USER` correctly reports no non-empty `User` field |
| non-root-user metadata | the same check on a Dockerfile with `USER app` correctly reports it |
| latest-tag detection | an unpinned `FROM debian:latest` is caught from the raw Dockerfile text |
| hadolint discrimination | flags a deliberately sloppy Dockerfile (6 findings: unpinned base, missing `-y`, no cleanup, `ADD` instead of `COPY`), silent on the clean one |

## What this PoC deliberately does not cover yet

- **Running the built image.** Grading stays scoped to "does this
  Dockerfile build cleanly and follow best practices," not "does the
  resulting container serve traffic correctly." Executing an arbitrary
  just-built image is the same untrusted-code-execution problem
  `sandbox-exec` already solves — revisit only if a future quest
  specifically needs runtime behavior, not preemptively.
- **Disk-quota beyond the `--memory` page-cache effect.** Finding #5
  above is a real, verified mitigation, not a deliberately-added quota —
  it's a side effect of cgroups v2 accounting, which depends on the
  production host actually running cgroups v2 (true for any current
  Debian/Ubuntu). A hard `--storage-opt size=` quota remains
  environment-dependent (needs a specific storage-driver/filesystem
  combination) and isn't configured here.
- **Alpine/Ubuntu package mirrors.** Only `deb.debian.org` /
  `security.debian.org` are allowlisted, matching what this project's
  other runner images already use. Same mechanism would extend to
  `dl-cdn.alpinelinux.org` etc. if a future quest needs a different base.

## Files

- `proxy/Dockerfile`, `proxy/squid.conf` — the egress-allowlist sidecar
- `fixtures/` — nine real Dockerfiles (clean, two egress-violation
  variants, fork-bomb, memory-bomb, root-user, non-root via `clean`,
  latest-tag, hadolint-violations), no synthetic/mocked output
- `poc-test.sh` — orchestrates the internal network, the proxy, and all
  nine fixture builds against the real Docker daemon; `./poc-test.sh` from
  this directory, no arguments
