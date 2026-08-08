FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash python3 nodejs jq coreutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work
COPY runner.sh /usr/local/bin/runner.sh
RUN chmod +x /usr/local/bin/runner.sh

# Same reasoning as infra/sandbox's Dockerfile: this grades real
# submissions from real people, not just fixtures it controls itself.
RUN useradd --no-create-home --uid 10001 judge
USER judge

ENTRYPOINT ["/usr/local/bin/runner.sh"]
