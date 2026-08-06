FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ clang make valgrind jq bc coreutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work
COPY judge.sh /usr/local/bin/judge.sh
RUN chmod +x /usr/local/bin/judge.sh

ENTRYPOINT ["/usr/local/bin/judge.sh"]
