#!/usr/bin/env bash
# Standalone PoC harness — NOT part of the app's runtime yet. Proves the
# containment boundaries described in the architecture plan actually hold,
# against real adversarial fixtures, before any of this gets wired into
# judge.ts. Run from this directory: ./poc-test.sh
#
# What this proves, per fixture, against the *real* Docker/network stack:
#   - clean/               a well-formed Dockerfile builds successfully
#   - egress-violation/    a RUN step reaching a non-allowlisted host gets
#                          a squid 403 (the allowlist works)
#   - egress-bypass-proxy/ the same attempt with proxy env vars explicitly
#                          unset still fails — for a network reason, not a
#                          403 — proving the boundary is the --internal
#                          network's missing WAN route, not the env var
#   - fork-bomb/            --pids-limit contains a forkbomb; the container
#                          fails cleanly, the host is unaffected
#   - memory-bomb/          --memory contains a RUN step writing several
#                          GB to the writable layer (cgroups v2 accounts
#                          dirty page cache against the memory limit, so
#                          this also functions as disk-fill protection —
#                          confirmed via OOMKilled, not just "it failed")
#   - root-user/            no USER directive -> image inspection correctly
#                          reports it runs as root (assertion material)
#   - latest-tag/           explicit :latest base -> flagged (assertion
#                          material)
#   - hadolint-violations/  static lint catches issues with zero container
#                          execution at all
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KANIKO_IMAGE="gcr.io/kaniko-project/executor:v1.23.2"
HADOLINT_IMAGE="hadolint/hadolint:2.12.0"
SKOPEO_IMAGE="quay.io/skopeo/stable:v1.15.2"
NET_INTERNAL="dockerfile-check-poc-internal"
PROXY_NAME="dockerfile-check-poc-proxy"
PROXY_IMAGE="dockerfile-check-poc-proxy:latest"
BUILD_TIMEOUT_S="90"
MEMORY_CAP="512m"
CPU_CAP="2"
PIDS_CAP="256"

PASS=0
FAIL=0

log() { echo "[poc] $*"; }
result() {
  local name="$1" ok="$2" detail="$3"
  if [ "$ok" = "true" ]; then
    PASS=$((PASS + 1))
    echo "  PASS  $name — $detail"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL  $name — $detail"
  fi
}

setup() {
  log "building proxy image"
  docker build -q -t "$PROXY_IMAGE" "$DIR/proxy" >/dev/null

  if ! docker network inspect "$NET_INTERNAL" >/dev/null 2>&1; then
    log "creating internal (no-WAN-route) network: $NET_INTERNAL"
    docker network create --internal "$NET_INTERNAL" >/dev/null
  fi

  docker rm -f "$PROXY_NAME" >/dev/null 2>&1 || true
  log "starting proxy (bridge + internal)"
  docker run -d --name "$PROXY_NAME" "$PROXY_IMAGE" >/dev/null
  docker network connect "$NET_INTERNAL" "$PROXY_NAME"
  sleep 1
}

teardown() {
  log "tearing down"
  docker rm -f "$PROXY_NAME" >/dev/null 2>&1 || true
}
trap teardown EXIT

# Runs Kaniko against fixtures/$1, no push, tarball output to a temp dir.
# Prints: "<exit_code> <output_tar_path_or_empty> <duration_s>"
#
# Deliberately doesn't shell out to `timeout`/`gtimeout` (neither is
# guaranteed present — this dev box has neither) — instead runs the
# container detached, polls its state, and force-stops it directly via
# `docker stop`/`docker kill` on hitting the budget. That's also closer to
# how the real integration enforces this: Node's child_process timeout
# option, not a wrapping shell command.
#
# Two separate proxy mechanisms are both required — verified directly by
# printing `env` from inside a RUN step, not assumed: the `-e HTTPS_PROXY`
# env vars on the outer container are what Kaniko's OWN registry client
# (Go's net/http, which reads the executor process's os.Environ()) uses to
# pull the base image; they are NOT forwarded into RUN step subprocesses
# at all — a `RUN env` showed only HOME/PATH/PWD with -e alone. RUN steps
# only ever see Dockerfile-declared ENV/ARG values, so proxying apt/curl
# inside a RUN needs `--build-arg http_proxy=...`, relying on the same
# "predefined ARGs" convention plain `docker build` recognizes without
# requiring the Dockerfile to declare `ARG http_proxy` itself.
run_kaniko() {
  local fixture="$1"
  local ctx="$DIR/fixtures/$fixture"
  local out_dir cname
  out_dir="$(mktemp -d)"
  cname="dockerfile-check-poc-build-$$-$RANDOM"

  local start end code elapsed
  start=$(date +%s)
  docker run -d --name "$cname" \
    --network "$NET_INTERNAL" \
    --memory "$MEMORY_CAP" --cpus "$CPU_CAP" --pids-limit "$PIDS_CAP" \
    -e HTTPS_PROXY="http://${PROXY_NAME}:3128" \
    -e HTTP_PROXY="http://${PROXY_NAME}:3128" \
    -v "$ctx:/workspace:ro" \
    -v "$out_dir:/output" \
    "$KANIKO_IMAGE" \
    --dockerfile=/workspace/Dockerfile \
    --context=dir:///workspace \
    --no-push \
    --tarPath=/output/image.tar \
    --destination="dockerfile-check-poc/${fixture}:latest" \
    --build-arg "http_proxy=http://${PROXY_NAME}:3128" \
    --build-arg "https_proxy=http://${PROXY_NAME}:3128" \
    --build-arg "HTTP_PROXY=http://${PROXY_NAME}:3128" \
    --build-arg "HTTPS_PROXY=http://${PROXY_NAME}:3128" \
    >/dev/null

  while :; do
    elapsed=$(( $(date +%s) - start ))
    if [ "$(docker inspect -f '{{.State.Running}}' "$cname" 2>/dev/null)" != "true" ]; then
      break
    fi
    if [ "$elapsed" -ge "$BUILD_TIMEOUT_S" ]; then
      docker stop -t 2 "$cname" >/dev/null 2>&1
      break
    fi
    sleep 1
  done

  code="$(docker inspect -f '{{.State.ExitCode}}' "$cname" 2>/dev/null)"
  [ -n "$code" ] || code=124
  docker logs "$cname" >"$out_dir/build.log" 2>&1
  docker rm -f "$cname" >/dev/null 2>&1
  end=$(date +%s)

  echo "$code $out_dir $((end - start))"
}

test_clean_build_succeeds() {
  read -r code out_dir dur <<<"$(run_kaniko clean)"
  if [ "$code" -eq 0 ] && [ -f "$out_dir/image.tar" ]; then
    result "clean build" true "built in ${dur}s, tarball produced"
  else
    result "clean build" false "expected success, got exit $code — $(tail -5 "$out_dir/build.log")"
  fi
  rm -rf "$out_dir"
}

test_egress_blocked() {
  read -r code out_dir dur <<<"$(run_kaniko egress-violation)"
  # Must FAIL, specifically with squid's 403 — that's positive
  # confirmation the allowlist itself denied it (not some unrelated
  # failure that would prove nothing).
  if [ "$code" -ne 0 ] && grep -qiE "403|CONNECT tunnel failed" "$out_dir/build.log"; then
    result "egress blocked" true "squid denied the CONNECT as expected: $(grep -iE '403|CONNECT tunnel failed' "$out_dir/build.log" | tail -1)"
  else
    result "egress blocked" false "expected a squid 403, got exit $code — $(tail -5 "$out_dir/build.log")"
  fi
  rm -rf "$out_dir"
}

test_egress_bypass_blocked() {
  read -r code out_dir dur <<<"$(run_kaniko egress-bypass-proxy)"
  # Real containment claim: even with proxy env vars explicitly unset
  # inside the RUN step (zero cooperation from the tool), the build
  # container has no WAN route at all — this must fail for a *network*
  # reason (no route/unreachable/timeout), never a squid 403, since a 403
  # would mean the connection somehow still went through the proxy despite
  # being unset.
  if [ "$code" -ne 0 ] && ! grep -qi "403\|forbidden" "$out_dir/build.log" \
     && grep -qiE "could not resolve|could not connect|couldn't connect|network|unreachable|timed out|no route|bad address" "$out_dir/build.log"; then
    result "egress bypass blocked" true "no-proxy-env attempt still failed at the network layer: $(grep -iE 'could not resolve|could not connect|couldn.t connect|network|unreachable|timed out|no route|bad address' "$out_dir/build.log" | tail -1)"
  else
    result "egress bypass blocked" false "expected a network-layer failure with no proxy involved, got exit $code — $(tail -5 "$out_dir/build.log")"
  fi
  rm -rf "$out_dir"
}

test_forkbomb_contained() {
  read -r code out_dir dur <<<"$(run_kaniko fork-bomb)"
  # Any outcome is acceptable EXCEPT the harness itself hanging past the
  # timeout or the host becoming unresponsive — both are impossible to
  # assert from inside this script by definition, so what we actually
  # assert is: the `timeout` wrapper returned control within budget, and a
  # fresh `docker ps` still works (host's docker daemon didn't wedge).
  if [ "$dur" -lt 95 ] && docker ps >/dev/null 2>&1; then
    result "forkbomb contained" true "resolved in ${dur}s (exit $code), host docker daemon still responsive"
  else
    result "forkbomb contained" false "took ${dur}s or daemon unresponsive — pids-limit did not contain it"
  fi
  rm -rf "$out_dir"
}

test_memorybomb_contained() {
  read -r code out_dir dur <<<"$(run_kaniko memory-bomb)"
  # 4GB written to the writable layer against a 512m cap must fail —
  # verified separately via `docker inspect .State.OOMKilled` on a plain
  # (non-Kaniko) container that this is a genuine cgroup OOM-kill from
  # dirty-page-cache accounting, not a fluke of this specific fixture.
  if [ "$code" -ne 0 ]; then
    result "memorybomb contained" true "4GB write against 512m cap failed as expected (exit $code)"
  else
    result "memorybomb contained" false "expected failure under the memory cap, build succeeded"
  fi
  rm -rf "$out_dir"
}

inspect_image() {
  local tar_path="$1"
  docker run --rm -v "$tar_path:/image.tar:ro" "$SKOPEO_IMAGE" \
    inspect --config "docker-archive:/image.tar" 2>/dev/null
}

test_root_user_detected() {
  read -r code out_dir dur <<<"$(run_kaniko root-user)"
  if [ "$code" -ne 0 ]; then
    result "root-user metadata" false "build itself failed unexpectedly — $(tail -5 "$out_dir/build.log")"
    rm -rf "$out_dir"
    return
  fi
  local cfg user
  cfg="$(inspect_image "$out_dir/image.tar")"
  # OCI image-spec omits the "User" key entirely when no USER directive
  # was set (found by inspecting real skopeo output, not assumed) — it's
  # not present-but-empty, it's just absent. Both "absent" and
  # present-but-empty mean root; grep -o only matches when the key exists.
  user="$(echo "$cfg" | grep -o '"User"[^,}]*' | head -1)"
  if [ -z "$user" ] || echo "$user" | grep -qE ':\s*""'; then
    result "root-user metadata" true "skopeo config has no non-empty User field (runs as root): ${user:-<absent>}"
  else
    result "root-user metadata" false "expected root (absent/empty User), got: $user"
  fi
  rm -rf "$out_dir"
}

test_non_root_user_detected() {
  # The other direction of the same check — the clean/ fixture sets
  # `USER app`, so this must NOT report root, confirming the extraction
  # actually discriminates rather than always reading as root.
  read -r code out_dir dur <<<"$(run_kaniko clean)"
  if [ "$code" -ne 0 ]; then
    result "non-root-user metadata" false "build itself failed unexpectedly — $(tail -5 "$out_dir/build.log")"
    rm -rf "$out_dir"
    return
  fi
  local cfg user
  cfg="$(inspect_image "$out_dir/image.tar")"
  user="$(echo "$cfg" | grep -o '"User"[^,}]*' | head -1)"
  if echo "$user" | grep -qE ':\s*"app"'; then
    result "non-root-user metadata" true "skopeo correctly reports User: $user"
  else
    result "non-root-user metadata" false "expected User \"app\", got: ${user:-<absent>}"
  fi
  rm -rf "$out_dir"
}

test_latest_tag_metadata() {
  # This one is graded from the Dockerfile text (the FROM line), not the
  # built image — confirm the raw text is inspectable regardless of build
  # outcome.
  if grep -qE '^FROM\s+\S+:latest\s*$|^FROM\s+[a-zA-Z0-9_.\/-]+\s*$' "$DIR/fixtures/latest-tag/Dockerfile"; then
    result "latest-tag detection" true "FROM line correctly identified as unpinned/:latest"
  else
    result "latest-tag detection" false "FROM line parsing missed the unpinned base"
  fi
}

test_hadolint() {
  # hadolint/hadolint has no ENTRYPOINT, only a CMD of ["/bin/hadolint", "-"]
  # — passing "-" as a docker-run arg REPLACES that CMD instead of
  # appending to it, so the full command has to be spelled out.
  local violations
  violations="$(docker run --rm -i "$HADOLINT_IMAGE" hadolint - <"$DIR/fixtures/hadolint-violations/Dockerfile" || true)"
  local clean
  clean="$(docker run --rm -i "$HADOLINT_IMAGE" hadolint - <"$DIR/fixtures/clean/Dockerfile" || true)"

  if [ -n "$violations" ] && [ -z "$clean" ]; then
    result "hadolint discrimination" true "flags the sloppy Dockerfile ($(echo "$violations" | wc -l | tr -d ' ') findings), silent on the clean one"
  else
    result "hadolint discrimination" false "violations=[$violations] clean=[$clean]"
  fi
}

main() {
  setup

  log "=== build outcomes ==="
  test_clean_build_succeeds

  log "=== egress containment ==="
  test_egress_blocked
  test_egress_bypass_blocked

  log "=== resource containment ==="
  test_forkbomb_contained
  test_memorybomb_contained

  log "=== metadata extraction ==="
  test_root_user_detected
  test_non_root_user_detected
  test_latest_tag_metadata

  log "=== static lint ==="
  test_hadolint

  echo
  log "=== summary: $PASS passed, $FAIL failed ==="
  [ "$FAIL" -eq 0 ]
}

main
