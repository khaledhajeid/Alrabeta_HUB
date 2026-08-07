FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ clang make valgrind jq bc coreutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work
COPY judge.sh /usr/local/bin/judge.sh
RUN chmod +x /usr/local/bin/judge.sh

# Phase 0 validated detection correctness against three known-good fixtures
# it controlled itself. Phase 5 runs this against real submissions from 14
# people, which is a different threat model — running as root inside the
# container is one avoidable part of that gap. mktemp -d/valgrind/gcc all
# work fine as a non-root user against a writable /tmp (the tmpfs Phase 5's
# `docker run` mounts there).
RUN useradd --no-create-home --uid 10001 judge
USER judge

ENTRYPOINT ["/usr/local/bin/judge.sh"]
