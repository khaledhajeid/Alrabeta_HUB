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
  --cap-add SYS_PTRACE \
  --security-opt seccomp=judge-seccomp.json \
  -v "$(pwd)/fixtures:/fixtures:ro" \
  alrabeta-judge /fixtures/clean.c
```

The `--cap-add SYS_PTRACE --security-opt seccomp=judge-seccomp.json` flags
are **required** — see the gotcha below. They can't be baked into the
Dockerfile (they're `docker run`-time options), so the Phase 5 worker's job
runner has to always pass them when it shells out to run a submission.

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
