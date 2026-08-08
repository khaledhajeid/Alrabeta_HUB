# Same target as egress-violation/, but with proxy env vars explicitly
# unset before the request — zero cooperation from the tool. curl still
# installs fine (that RUN step runs before the unset, with the proxy env
# still in place). The real containment claim is that the second RUN step
# fails for a *network* reason (no route out of the --internal network),
# not because squid denied it — proving the boundary isn't the env var.
FROM debian:bookworm-slim

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY && \
    curl -sS --max-time 5 https://example.com -o /tmp/exfil-target-reached
