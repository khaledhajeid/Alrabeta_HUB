# git-assert sandbox — the third grading strategy

Phase 7's `git-assert` runner: grades a submission by inspecting real git
history (commit count, merge structure, message conventions) rather than
running or compiling anything the submitter wrote. Same
validate-before-trust discipline as `infra/sandbox` and
`infra/sandbox-io-match` — this found two real bugs before anything used
it for real grading.

## What it does

`runner.sh` takes two arguments: a path to a **full clone** of the
submission's repo (not a tarball snapshot — see `judge.ts`'s module comment
for why git-assert needs its own fetch path), and a JSON spec:

```json
{
  "base_ref": "main",
  "commit_sha": "<the submitted commit>",
  "assertions": [
    {"type": "no-merge-commits"},
    {"type": "commit-count", "op": "eq", "value": 3},
    {"type": "commit-message-matches", "pattern": "^(feat|fix|chore): .+"}
  ]
}
```

Assertions run against the range `origin/<base_ref>..<commit_sha>` — the
commits the submission actually introduced, not the whole repo history.
`op` for `commit-count` is `eq`/`min`/`max`.

## Why this needs a different trust boundary than the other two runners

`sandbox-exec` and `io-match` sandbox because they **execute** submitted
code. `git-assert` doesn't execute anything the submitter wrote — it runs
fixed `git log`/`git rev-list`/`cat-file` plumbing and parses the output.
But the repo's *content* (commit messages, tree shape, object graph) is
still fully attacker-controlled even though its *source* (Forgejo, a
trusted host) isn't — "untrusted input is untrusted input" has been this
project's rule since Phase 0, and a malformed-object git CLI bug is a real
CVE class, not a hypothetical one. So: the `git clone` itself (needs
network, hits the trusted Forgejo host with the server's own token) stays
on the host, exactly like the existing tarball download for the other
runners. Only the *inspection* of the already-cloned repo runs in this
sandboxed, `--network none` container.

## Run it

```bash
docker build -t alrabeta-git-assert .

./fixtures/build-fixtures.sh /tmp/git-assert-fixtures

docker run --rm \
  --network none --memory 256m --cpus 1 --pids-limit 128 \
  --read-only --tmpfs /tmp:rw,exec,size=64m,mode=1777 \
  -v /tmp/git-assert-fixtures/clean:/repo:ro \
  -v /tmp/git-assert-fixtures/clean-spec.json:/spec.json:ro \
  alrabeta-git-assert /repo /spec.json
```

**No custom seccomp profile** — same reasoning as `io-match`: validated
against Docker's stock default profile for the scope actually tested here
(git plumbing commands against a mounted repo), not a blanket guarantee.

## The two bugs this found

**1. `git config --global` silently failed.** The `judge` user has no home
directory (`useradd --no-create-home`, same as every other judge image —
no reason to give a grading container a persistent home). `git config
--global --add safe.directory ...` tries to write `$HOME/.gitconfig`,
which doesn't exist, and fails — into stderr, with the script still
exiting 0, so nothing about the JSON output looked wrong. The fixture run
that first caught this *happened* to still produce a correct verdict,
which made it easy to miss — on macOS Docker Desktop, the bind-mounted
fixture repos apparently didn't trigger git's "dubious ownership" check the
way a real Linux host reliably would, so the safe-directory config not
actually being set didn't (this time) block anything. That's exactly the
kind of "works by accident in one environment" trap this project's own
prior bugs (jq missing `-n`, the BullMQ colon issue) have already
demonstrated — caught here by actually reading stderr during fixture
testing, not by trusting a clean exit code. Fixed with `GIT_CONFIG_GLOBAL`
(git ≥2.32) pointed at the already-writable `/tmp` tmpfs instead of
requiring a real `$HOME`.

**2. The all-zero SHA passed as "verified."** `git rev-parse --verify
0000000000000000000000000000000000000000` returns exit 0 and echoes the
hash back — git treats it as the "null object" sentinel used in
ref-update-hook conventions, not as "no such object." A commit-sha
validity check built on `rev-parse --verify` alone would silently accept a
non-existent commit and proceed to build a nonsense range. Fixed by
switching to `git cat-file -e <sha>^{commit}`, which actually resolves the
object and requires it to be a real commit.

Same fail-open shape as every prior bug this project has found in its
sandbox images: something that looks like it worked (clean exit, plausible
output) but silently didn't do the check it claimed to.

## Validated results

| fixture | expected | got |
|---|---|---|
| `clean` (3 linear conventional commits) | pass | `verdict: "violet"`, all 3 checks pass |
| `wrong-count` (2 commits, quest expects 3) | commit-count fails | `verdict: "failed"`, `commit-count` check false, others pass |
| `has-merge` (a real merge commit in range) | no-merge-commits fails | `verdict: "failed"` — also correctly fails the message check, since the merge commit's own auto-generated subject doesn't match the conventional pattern either |
| `bad-message` (non-conventional subject) | message check fails | `verdict: "failed"`, names the offending subject line |
| missing `commit_sha` in spec | rejected before any assertion runs | `ran: false`, `error: "spec is missing commit_sha"` |
| all-zero `commit_sha` | rejected, not silently "verified" | `ran: false`, `error: "commit ... not found in clone"` |

All six re-verified under the full hardened flag set above, not just
unhardened.

## Files

- `Dockerfile` — debian:bookworm-slim + git/jq/bash, non-root user
  (uid 10001), same reasoning as the other two sandbox images
- `runner.sh` — the grading script (also the image's entrypoint)
- `fixtures/build-fixtures.sh` — generates real git repos with real commit
  history into a scratch dir for testing; not copied into the image, a
  dev-time tool only (mirrors why `sandbox-io-match`'s fixtures are real
  scripts, not mocked output)
