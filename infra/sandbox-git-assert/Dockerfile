FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash git jq coreutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work
COPY runner.sh /usr/local/bin/runner.sh
RUN chmod +x /usr/local/bin/runner.sh

# Same reasoning as infra/sandbox and infra/sandbox-io-match: this inspects
# real submitted repos from real people, not just fixtures it controls
# itself — non-root, same as every other judge image.
RUN useradd --no-create-home --uid 10001 judge
USER judge

ENTRYPOINT ["/usr/local/bin/runner.sh"]
