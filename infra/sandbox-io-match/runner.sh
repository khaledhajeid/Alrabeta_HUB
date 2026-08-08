#!/usr/bin/env bash
set -uo pipefail

# $1 = path to the submitted script, $2 = path to a JSON array of test cases:
#   [{"name": "...", "stdin": "...", "args": ["..."], "expected_stdout": "..."}]
# Mirrors infra/sandbox/judge.sh's contract: always exit 0, always print one
# JSON verdict to stdout — the caller (judge.ts) decides what a non-zero
# exit or malformed output means, and it should never mean "clean".

SCRIPT="${1:-}"
CASES="${2:-}"
TIMEOUT_SECS=5

fail_json() {
  jq -n --arg reason "$1" '{
    ran: false,
    tests_passed: false,
    cases: [],
    duration_ms: 0,
    verdict: "failed",
    error: $reason
  }'
  exit 0
}

[ -f "$SCRIPT" ] || fail_json "script not found"
[ -f "$CASES" ] || fail_json "test cases file not found"
jq -e . "$CASES" >/dev/null 2>&1 || fail_json "test cases file is not valid JSON"

case "$SCRIPT" in
  *.sh)  INTERPRETER="bash" ;;
  *.py)  INTERPRETER="python3" ;;
  *.js)  INTERPRETER="node" ;;
  *)     fail_json "unrecognized script extension (expected .sh, .py, or .js)" ;;
esac

START_MS=$(date +%s%3N)
RESULTS="[]"
ALL_PASSED=true

CASE_COUNT=$(jq 'length' "$CASES")
for i in $(seq 0 $((CASE_COUNT - 1))); do
  CASE=$(jq -c ".[$i]" "$CASES")
  NAME=$(echo "$CASE" | jq -r '.name // "case \($ARGS.positional[0])"' --args "$i")
  STDIN=$(echo "$CASE" | jq -r '.stdin // ""')
  EXPECTED=$(echo "$CASE" | jq -r '.expected_stdout // ""')
  # readarray keeps each arg intact even if it contains spaces.
  readarray -t ARGS_ARR < <(echo "$CASE" | jq -r '.args // [] | .[]')

  ACTUAL=$(printf '%s' "$STDIN" | timeout "$TIMEOUT_SECS" "$INTERPRETER" "$SCRIPT" "${ARGS_ARR[@]}" 2>/dev/null)
  EXIT_CODE=$?

  # A case killed by the timeout (124) or any other signal is a fail, not a
  # pass with an empty diff — same fail-safe-not-fail-open principle as
  # judge.sh's TSan-crash handling in the C/C++ runner.
  if [ "$EXIT_CODE" -eq 0 ] && [ "$(printf '%s' "$ACTUAL" | sed -e 's/[[:space:]]*$//')" = "$(printf '%s' "$EXPECTED" | sed -e 's/[[:space:]]*$//')" ]; then
    PASSED=true
  else
    PASSED=false
    ALL_PASSED=false
  fi

  # -n: this filter only reads --arg/--argjson bindings, not stdin — without
  # it jq waits on stdin (empty/closed under `docker run`) and silently
  # produces zero output despite exiting 0, which would have quietly turned
  # every case's result into nothing rather than a real error.
  RESULTS=$(jq -nc --argjson results "$RESULTS" \
    --arg name "$NAME" --arg expected "$EXPECTED" --arg actual "$ACTUAL" \
    --argjson passed "$PASSED" --argjson exit_code "$EXIT_CODE" \
    '$results + [{name: $name, passed: $passed, expected_stdout: $expected, actual_stdout: $actual, exit_code: $exit_code}]')
done

END_MS=$(date +%s%3N)
DURATION=$((END_MS - START_MS))

if [ "$ALL_PASSED" = true ]; then VERDICT="violet"; else VERDICT="failed"; fi

jq -n --argjson cases "$RESULTS" --argjson tests_passed "$ALL_PASSED" \
  --argjson duration_ms "$DURATION" --arg verdict "$VERDICT" \
  '{ran: true, tests_passed: $tests_passed, cases: $cases, duration_ms: $duration_ms, verdict: $verdict}'
