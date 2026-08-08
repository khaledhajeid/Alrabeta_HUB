# Simulates a malicious submission trying to exfiltrate data or pull a
# second-stage payload from a host that isn't on the registry/mirror
# allowlist. curl (not busybox wget — verified separately that Alpine's
# busybox wget doesn't reliably tunnel HTTPS through an env-var proxy, so
# it failed on DNS before ever reaching squid, which would have proven the
# wrong thing) is installed first via the already-allowlisted Debian
# mirror, then used to hit a real, non-allowlisted host.
FROM debian:bookworm-slim

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sS --max-time 5 https://example.com -o /tmp/exfil-target-reached
