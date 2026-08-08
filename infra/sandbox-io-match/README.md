# io-match sandbox — the second grading strategy

Phase 7's `io-match` runner: grades a submitted script (Bash/Python/Node)
against stdin→stdout test cases, in a hardened container, for the
Foundations quests that aren't C/C++ (Bash scripting first — Python/Node
support exists for the same convention but isn't exercised by a real quest
yet). Same validate-before-trust discipline as `infra/sandbox` — this
found a real bug before anything used it for real grading.

## What it does

`runner.sh` takes two arguments: the submitted script, and a JSON file of
test cases (`[{name, stdin, args, expected_stdout}]`). It detects the
interpreter by extension (`.sh` → bash, `.py` → python3, `.js` → node),
runs the script once per case under a 5s `timeout` with the case's stdin
piped in, and compares trimmed stdout against `expected_stdout`.

Unlike the C/C++ judge, there's no "clean but tripped a sanitizer" middle
state — `verdict` is `"violet"` if every case passes, `"failed"` otherwise.

## Run it

```bash
docker build -t alrabeta-io-match .

docker run --rm \
  --network none \
  --memory 512m --cpus 1 --pids-limit 128 \
  --read-only --tmpfs /tmp:rw,exec,size=64m,mode=1777 \
  -v "$(pwd)/fixtures:/fixtures:ro" \
  alrabeta-io-match /fixtures/clean.sh /fixtures/cases.json
```

**No custom seccomp profile, unlike `infra/sandbox`** — validated against
Docker's stock default profile, and bash/python3/node all ran clean under
it for the scope actually tested here (basic stdin/stdout scripts). That's
not a guarantee it covers every possible submission (a script reaching for
something more exotic — `worker_threads`, certain `crypto` calls — might
hit a blocked syscall the same way TSan's `personality()` call did in the
C/C++ judge), just what's been verified. Re-verify against the fixtures
below if that ever comes up, the same way Phase 0/5 did.

## The bug this found

First run under `docker run` (no `-i`, so stdin is closed/empty) produced
**zero output and exit code 0** for the per-case JSON-accumulation step —
not an error, just silently nothing. `jq`'s default input source is stdin;
a filter that never references `.` still doesn't run at all against an
empty/closed stdin unless invoked with `-n` (null-input). The accumulator
call built a JSON array purely from `--arg`/`--argjson` bindings and never
touched `.`, but was missing `-n` — so it produced nothing, `RESULTS`
silently became an empty string instead of `"[]"`, and the final verdict
JSON construction failed on invalid JSON input.

This is the same fail-open shape as the seccomp and tmpfs bugs found in
`infra/sandbox` — a script that looked like it worked (`exit 0`, no error
message) but had silently not done the thing it was supposed to. Caught by
actually running it and checking the output, not by reading the script and
assuming the `set -uo pipefail` header would catch a problem (`pipefail`
only flags a *failing* command in a pipeline — this one exited 0).

**Lesson, same as before**: `jq` invocations that don't pipe input and
don't reference `.` need `-n` explicitly. Worth grepping for the next time
this script changes, not just trusting a clean-looking diff.

## Validated results

| fixture | expected | got |
|---|---|---|
| `fixtures/clean.sh` / `.py` / `.js` | pass | `verdict: "violet"`, all three interpreters |
| `fixtures/wrong-output.sh` | wrong stdout caught | `verdict: "failed"`, case shows the actual vs expected diff |
| `fixtures/hangs.sh` | timeout caught | `exit_code: 124`, `verdict: "failed"` (~5.1s, matching the 5s per-case timeout) |

All five re-verified under the full hardened flag set above, not just
unhardened — same requirement as any future change to this script or its
run flags.

## Files

- `Dockerfile` — debian:bookworm-slim + bash/python3/nodejs/jq, non-root
  user (uid 10001), same reasoning as `infra/sandbox`
- `runner.sh` — the grading script (also the image's entrypoint)
- `fixtures/` — `clean.{sh,py,js}`, `wrong-output.sh`, `hangs.sh`,
  `cases.json` (shared test-case file for all of the above)
