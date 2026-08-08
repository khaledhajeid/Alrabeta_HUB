# Adversarial RUN step: classic bash fork bomb. --pids-limit on the outer
# `docker run` for the build container must contain this — it's a cgroup
# limit that covers every process inside the container, including ones
# spawned by a RUN step, not just the build tool's own process.
FROM debian:bookworm-slim

RUN bash -c ':(){ :|:& };:' || true
RUN echo "survived the fork bomb attempt"
