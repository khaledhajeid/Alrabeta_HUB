#!/usr/bin/env bash
# Alrabeta Hub — sandbox judge PoC.
# Compiles + runs a C/C++ submission and reports memory/thread safety
# findings as structured JSON. Used to decide Violet-tier badge eligibility.
set -u

SRC="$1"
TMP="$(mktemp -d)"
START_MS=$(($(date +%s%N)/1000000))

fail_json() {
  local reason="$1"
  jq -n --arg reason "$reason" '{
    compiled: false, exit_code: null, tests_passed: false,
    valgrind: null, asan_ubsan: null, tsan: null,
    verdict: "failed", error: $reason
  }'
  exit 0
}

[ -f "$SRC" ] || fail_json "source file not found: $SRC"

case "$SRC" in
  *.cpp|*.cc|*.cxx) CC=g++ ;;
  *) CC=gcc ;;
esac

USES_PTHREAD=0
grep -q "pthread_create" "$SRC" && USES_PTHREAD=1

# ---------- plain build (functional correctness) ----------
if ! "$CC" -O0 -g -o "$TMP/plain" "$SRC" -lpthread 2> "$TMP/compile.log"; then
  fail_json "compile failed: $(head -c 400 "$TMP/compile.log")"
fi

timeout 5 "$TMP/plain" > "$TMP/plain.out" 2> "$TMP/plain.err"
PLAIN_EXIT=$?
TESTS_PASSED="false"
[ "$PLAIN_EXIT" -eq 0 ] && TESTS_PASSED="true"

# ---------- valgrind (memory safety on the plain binary) ----------
timeout 30 valgrind --leak-check=full --error-exitcode=99 --track-origins=no \
  "$TMP/plain" > "$TMP/vg.out" 2> "$TMP/vg.log"
VG_EXIT=$?

DEFINITELY_LOST=$(grep -oE "definitely lost: [0-9,]+ bytes" "$TMP/vg.log" | grep -oE "[0-9,]+" | tr -d ',' | head -1)
DEFINITELY_LOST=${DEFINITELY_LOST:-0}
VG_ERRORS=$(grep -oE "ERROR SUMMARY: [0-9]+ errors" "$TMP/vg.log" | grep -oE "[0-9]+" | head -1)
VG_ERRORS=${VG_ERRORS:-0}
VG_CLEAN="false"
[ "$DEFINITELY_LOST" -eq 0 ] && [ "$VG_ERRORS" -eq 0 ] && VG_CLEAN="true"

# ---------- ASan + UBSan build ----------
ASAN_CLEAN="true"
ASAN_FINDINGS="[]"
if "$CC" -O0 -g -fsanitize=address,undefined -o "$TMP/asan" "$SRC" -lpthread 2> "$TMP/asan_compile.log"; then
  ASAN_OPTIONS="detect_leaks=1" UBSAN_OPTIONS="print_stacktrace=1" \
    timeout 10 "$TMP/asan" > "$TMP/asan.out" 2> "$TMP/asan.log"
  if grep -qE "ERROR: (AddressSanitizer|LeakSanitizer)|runtime error:" "$TMP/asan.log"; then
    ASAN_CLEAN="false"
    ASAN_FINDINGS=$(grep -oE "ERROR: [A-Za-z]+Sanitizer[^\n]*|runtime error:[^\n]*" "$TMP/asan.log" | head -5 | jq -R . | jq -s .)
  fi
else
  ASAN_CLEAN="false"
  ASAN_FINDINGS='["asan build failed to compile"]'
fi

# ---------- TSan build (only if the source touches pthreads) ----------
TSAN_CLEAN="true"
TSAN_RACES=0
TSAN_SKIPPED="false"
TSAN_CRASHED="false"
if [ "$USES_PTHREAD" -eq 1 ]; then
  if "$CC" -O0 -g -fsanitize=thread -o "$TMP/tsan" "$SRC" -lpthread 2> "$TMP/tsan_compile.log"; then
    timeout 10 "$TMP/tsan" > "$TMP/tsan.out" 2> "$TMP/tsan.log"
    TSAN_EXIT=$?
    TSAN_RACES=$(grep -cE "WARNING: ThreadSanitizer" "$TMP/tsan.log")
    if [ "$TSAN_RACES" -gt 0 ]; then
      TSAN_CLEAN="false"
    elif [ "$TSAN_EXIT" -gt 128 ]; then
      # Killed by a signal (e.g. TSan's runtime init failing under a
      # restrictive seccomp profile) rather than exiting cleanly or
      # printing a report. Never treat a crash as "no findings" -- a
      # sandbox bug here would silently grant Violet-tier badges.
      TSAN_CLEAN="false"
      TSAN_CRASHED="true"
    fi
  else
    TSAN_CLEAN="false"
    TSAN_SKIPPED="false"
  fi
else
  TSAN_SKIPPED="true"
fi

END_MS=$(($(date +%s%N)/1000000))
DURATION_MS=$((END_MS-START_MS))

VERDICT="clean"
if [ "$TESTS_PASSED" != "true" ]; then
  VERDICT="failed"
elif [ "$VG_CLEAN" = "true" ] && [ "$ASAN_CLEAN" = "true" ] && [ "$TSAN_CLEAN" = "true" ]; then
  VERDICT="violet"
fi

jq -n \
  --argjson compiled true \
  --argjson exit_code "$PLAIN_EXIT" \
  --argjson tests_passed "$TESTS_PASSED" \
  --argjson vg_leaks "$DEFINITELY_LOST" \
  --argjson vg_errors "$VG_ERRORS" \
  --argjson vg_clean "$VG_CLEAN" \
  --argjson asan_clean "$ASAN_CLEAN" \
  --argjson asan_findings "$ASAN_FINDINGS" \
  --argjson tsan_clean "$TSAN_CLEAN" \
  --argjson tsan_races "$TSAN_RACES" \
  --argjson tsan_skipped "$TSAN_SKIPPED" \
  --argjson tsan_crashed "$TSAN_CRASHED" \
  --argjson duration_ms "$DURATION_MS" \
  --arg verdict "$VERDICT" \
  '{
    compiled: $compiled,
    exit_code: $exit_code,
    tests_passed: $tests_passed,
    valgrind: { leaked_bytes: $vg_leaks, errors: $vg_errors, clean: $vg_clean },
    asan_ubsan: { clean: $asan_clean, findings: $asan_findings },
    tsan: { clean: $tsan_clean, races: $tsan_races, skipped: $tsan_skipped, crashed: $tsan_crashed },
    duration_ms: $duration_ms,
    verdict: $verdict
  }'

rm -rf "$TMP"
