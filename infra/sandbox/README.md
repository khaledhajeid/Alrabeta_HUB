# Sandbox judge — proof of concept

Derisks the "Judge & reviewer" architecture layer and the Violet-tier
gamification rule (a badge granted only when a systems-level quest is solved
on the first try with zero findings from valgrind and ThreadSanitizer).
This proves the detection pipeline actually works in Docker on this machine
before Phase 5 builds the real worker around it.

## What it does

`judge.sh` compiles a C/C++ source file three ways and reports a single JSON
verdict:

1. **Plain build** — did it compile, did it run, exit code (stand-in for
   "tests passed" until the real test harness exists).
2. **valgrind** (`--leak-check=full`) — memory leaks.
3. **ASan + UBSan build** — memory errors, undefined behavior.
4. **TSan build** — data races, only attempted if the source calls
   `pthread_create`.

`verdict` is `"violet"` only if the program ran successfully and all three
checks came back clean; `"clean"` if it ran but tripped a sanitizer;
`"failed"` if it didn't compile or didn't run successfully.

## Run it

```bash
docker build -t alrabeta-judge .

docker run --rm \
  --network none \
  --memory 512m --cpus 1 --pids-limit 128 \
  --read-only --tmpfs /tmp:rw,exec,size=64m,mode=1777 \
  --cap-add SYS_PTRACE \
  --security-opt seccomp=judge-seccomp.json \
  -v "$(pwd)/fixtures:/fixtures:ro" \
  alrabeta-judge /fixtures/clean.c
```

None of these flags are optional — every one is load-bearing (see the two
gotchas below), and `src/server/judge.ts` (Phase 5) has to pass this exact
set every time it shells out to grade a real submission.

## Phase 5 hardening — and the bug it found

Phase 0 validated *detection correctness* against three fixtures it
controlled itself. Phase 5 runs this against real submissions from 14
people, which is a different threat model, so before wiring it up to real
grading the container got hardened: `--network none` (no exfiltration, no
using the sandbox as a launchpad), memory/CPU/`--pids-limit` (bounds a
runaway allocation or fork bomb), `--read-only` root with a `tmpfs` for
build scratch space, and a non-root user in the image (`USER judge`,
uid 10001 — the original Dockerfile ran everything as root).

**Re-verifying against the same three fixtures after hardening caught a
second real fail-open bug**, this one worse than the seccomp one: with
`--read-only --tmpfs /tmp:rw,size=64m` (no `exec` flag), every fixture came
back `verdict: "failed"`, `exit_code: 126` — and `racy.c` specifically came
back `tsan.clean: true, races: 0`. Not "no findings" — the compiled binary
never executed at all, because **Docker's `--tmpfs` mount defaults to
`noexec`**, and `judge.sh` compiles into `$TMP` under `/tmp` and then runs
the result from there. A submission that was never actually checked would
have silently reported clean — the exact failure mode the seccomp fix in
Phase 0 was written to prevent, reintroduced by hardening meant to make
things safer. Fixed by mounting the tmpfs with `exec` explicitly
(`--tmpfs /tmp:rw,exec,size=64m,mode=1777`), then re-verified all three
fixtures produce correct verdicts under the *full* hardened flag set
together, not just the tmpfs fix in isolation.

**Lesson carried forward**: any future change to this container's run
flags — hardening or otherwise — needs the same re-verification against
`fixtures/{clean,leaky,racy}.c` before it ships, not just a check that the
container starts. "It runs" and "it correctly detects the thing it exists
to detect" are different claims.

## Validated results (Apple Silicon, Docker Desktop, linux/arm64)

| fixture | expected | got | verdict |
|---|---|---|---|
| `fixtures/clean.c` | fully clean | 0 leaks, 0 ASan/UBSan findings, 0 races | `violet` ✅ |
| `fixtures/leaky.c` | leak caught | valgrind: 9 bytes definitely lost, 1 error; LeakSanitizer also caught it | `clean` ✅ |
| `fixtures/racy.c` | race caught | TSan: 1 race reported at `racy.c:8` | `clean` ✅ |

## Timing

~0.8–1.1s wall time per submission (compile ×3 + run ×3 + valgrind, inside
`docker run`). Cheap enough that a burst of 14 people pushing at once on
quest-release day is not a capacity concern by itself — the BullMQ worker
concurrency cap discussed in the architecture doc is about smoothing Claude
API calls, not sandbox throughput.

## The gotcha: TSan segfaults under Docker's default seccomp profile

First run of the `racy.c` fixture didn't report a race — it silently
**segfaulted** instead, and the judge script's original logic read "no
`WARNING: ThreadSanitizer` in the log" as *clean*. That's exactly the kind
of bug that would have silently handed out a Violet badge for a program
that never actually got checked. Two fixes, both required:

1. **Root cause**: ThreadSanitizer calls `personality(ADDR_NO_RANDOMIZE)` to
   disable ASLR at startup, and Docker's default seccomp profile blocks the
   `personality` syscall. The crash was:
   ```
   ThreadSanitizer: CHECK failed: tsan_platform_linux.cpp:315
   "((personality(old_personality | ADDR_NO_RANDOMIZE))) != ((-1))"
   ```
   `--security-opt seccomp=unconfined` "fixes" this but disables syscall
   filtering entirely for a container whose whole job is running untrusted
   code someone else wrote — not acceptable for the real system. Instead,
   `judge-seccomp.json` here is Docker's actual default profile
   (from `moby/profiles`) with exactly one syscall, `personality`, added to
   the allow-list. Same containment as stock Docker, minus the one syscall
   TSan needs at startup.

2. **Defense in depth**: `judge.sh` now explicitly checks whether the TSan
   binary was killed by a signal (`exit code > 128`) and treats that as
   `tsan.clean: false, tsan.crashed: true` rather than defaulting to clean.
   If the seccomp profile ever regresses on a different host, the judge
   fails safe (denies Violet / flags for review) instead of failing open.

**Carry into Phase 5**: the real worker must ship `judge-seccomp.json`
alongside the judge image and always pass both `docker run` flags. Worth a
CI/startup smoke test that runs `fixtures/racy.c` and asserts
`tsan.crashed == false` and `tsan.races == 1`, so a future Docker/host
upgrade that reintroduces this can't silently regress Violet-tier grading.

## Files

- `Dockerfile` — debian:bookworm-slim + gcc/g++/clang/valgrind/jq
- `judge.sh` — the judge script (also the image's entrypoint)
- `judge-seccomp.json` — Docker's default seccomp profile + `personality`
- `fixtures/clean.c`, `fixtures/leaky.c`, `fixtures/racy.c` — validation set
