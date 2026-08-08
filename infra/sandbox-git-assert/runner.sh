#!/usr/bin/env bash
set -uo pipefail

# $1 = path to a full clone of the submission's repo (mounted read-only),
# $2 = path to a JSON spec:
#   {"base_ref": "main", "commit_sha": "<sha>", "assertions": [...]}
# Mirrors sandbox-io-match/runner.sh's contract: always exit 0, always print
# one JSON verdict to stdout.

REPO="${1:-}"
SPEC="${2:-}"

fail_json() {
  jq -n --arg reason "$1" '{
    ran: false,
    tests_passed: false,
    checks: [],
    duration_ms: 0,
    verdict: "failed",
    error: $reason
  }'
  exit 0
}

[ -d "$REPO" ] || fail_json "repo not found"
[ -f "$SPEC" ] || fail_json "spec file not found"
jq -e . "$SPEC" >/dev/null 2>&1 || fail_json "spec file is not valid JSON"

# The clone on disk is owned by whatever UID did the `git clone` on the
# host, not this container's non-root `judge` user — git refuses to operate
# on a repo it doesn't own ("detected dubious ownership") since CVE-2022-24765,
# and that's a real, current-git-version behavior, not a hypothetical one.
#
# `judge` has no home dir (useradd --no-create-home), so a plain
# `git config --global` has nowhere to write and fails silently into
# stderr while still exiting 0 — caught by actually reading stderr during
# fixture testing, not assumed from the exit code. GIT_CONFIG_GLOBAL
# (git >= 2.32) redirects "global" config to the writable tmpfs already
# mounted at /tmp instead of requiring $HOME/.gitconfig.
export GIT_CONFIG_GLOBAL=/tmp/.gitconfig
git config --global --add safe.directory "$REPO"

BASE_REF=$(jq -r '.base_ref // "main"' "$SPEC")
COMMIT_SHA=$(jq -r '.commit_sha // empty' "$SPEC")
[ -n "$COMMIT_SHA" ] || fail_json "spec is missing commit_sha"

BASE="origin/$BASE_REF"
git -C "$REPO" rev-parse --verify "$BASE" >/dev/null 2>&1 || fail_json "base ref '$BASE_REF' not found in clone"
# `rev-parse --verify` is NOT the right existence check here: git treats
# the all-zero SHA as its "null object" sentinel and echoes it back with
# exit 0 even though no such object exists — a real, found-by-testing
# fail-open, not a hypothetical. `cat-file -e ...^{commit}` actually
# resolves the object and requires it to be a commit.
git -C "$REPO" cat-file -e "${COMMIT_SHA}^{commit}" 2>/dev/null || fail_json "commit $COMMIT_SHA not found in clone"

RANGE="$BASE..$COMMIT_SHA"

START_MS=$(date +%s%3N)
CHECKS="[]"
ALL_PASSED=true

add_check() {
  # -n: same reason as every other jq call in this project's runner
  # images — no piped stdin, no top-level `.` reference, so without -n it
  # silently waits on stdin (closed under `docker run`) and produces zero
  # output despite exiting 0.
  CHECKS=$(jq -nc --argjson checks "$CHECKS" --arg name "$1" --argjson passed "$2" --arg detail "$3" \
    '$checks + [{name: $name, passed: $passed, detail: $detail}]')
}

ASSERTION_COUNT=$(jq '.assertions | length' "$SPEC")
for i in $(seq 0 $((ASSERTION_COUNT - 1))); do
  ASSERTION=$(jq -c ".assertions[$i]" "$SPEC")
  TYPE=$(echo "$ASSERTION" | jq -r '.type')

  case "$TYPE" in
    no-merge-commits)
      MERGE_COUNT=$(git -C "$REPO" log --merges --format=%H "$RANGE" | wc -l | tr -d ' ')
      if [ "$MERGE_COUNT" -eq 0 ]; then
        add_check "no-merge-commits" true "0 merge commits in $RANGE"
      else
        add_check "no-merge-commits" false "$MERGE_COUNT merge commit(s) found in $RANGE"
        ALL_PASSED=false
      fi
      ;;
    commit-count)
      OP=$(echo "$ASSERTION" | jq -r '.op')
      VALUE=$(echo "$ASSERTION" | jq -r '.value')
      ACTUAL=$(git -C "$REPO" rev-list --count "$RANGE")
      case "$OP" in
        eq) [ "$ACTUAL" -eq "$VALUE" ] && PASSED=true || PASSED=false ;;
        min) [ "$ACTUAL" -ge "$VALUE" ] && PASSED=true || PASSED=false ;;
        max) [ "$ACTUAL" -le "$VALUE" ] && PASSED=true || PASSED=false ;;
        *) PASSED=false ;;
      esac
      add_check "commit-count" "$PASSED" "$ACTUAL commits in $RANGE (expected $OP $VALUE)"
      [ "$PASSED" = true ] || ALL_PASSED=false
      ;;
    commit-message-matches)
      PATTERN=$(echo "$ASSERTION" | jq -r '.pattern')
      BAD_SUBJECT=""
      PASSED=true
      while IFS= read -r SUBJECT; do
        [ -z "$SUBJECT" ] && continue
        if ! echo "$SUBJECT" | grep -qE "$PATTERN"; then
          PASSED=false
          BAD_SUBJECT="$SUBJECT"
          break
        fi
      done < <(git -C "$REPO" log --format=%s "$RANGE")
      if [ "$PASSED" = true ]; then
        add_check "commit-message-matches" true "every commit subject in $RANGE matches /$PATTERN/"
      else
        add_check "commit-message-matches" false "\"$BAD_SUBJECT\" does not match /$PATTERN/"
        ALL_PASSED=false
      fi
      ;;
    *)
      add_check "$TYPE" false "unrecognized assertion type"
      ALL_PASSED=false
      ;;
  esac
done

END_MS=$(date +%s%3N)
DURATION=$((END_MS - START_MS))

if [ "$ALL_PASSED" = true ]; then VERDICT="violet"; else VERDICT="failed"; fi

jq -n --argjson checks "$CHECKS" --argjson tests_passed "$ALL_PASSED" \
  --argjson duration_ms "$DURATION" --arg verdict "$VERDICT" \
  '{ran: true, tests_passed: $tests_passed, checks: $checks, duration_ms: $duration_ms, verdict: $verdict}'
