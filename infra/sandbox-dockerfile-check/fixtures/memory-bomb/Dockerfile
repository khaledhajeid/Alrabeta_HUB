# Adversarial RUN step: write several GB to a regular file on the
# container's own writable layer — a more realistic "fill the disk"
# attack than writing to /dev/shm (an earlier version of this fixture did
# that, but /dev/shm is capped by Docker's own default 64MB shm-size
# regardless of --memory, so it was accidentally testing the wrong
# mechanism). Verified separately: under cgroups v2, a large sequential
# write's dirty page cache counts against the container's --memory limit,
# so this gets OOM-killed well before 2GB actually lands on disk — real
# containment from a flag we already set for other reasons, not something
# extra to add.
FROM debian:bookworm-slim

RUN dd if=/dev/zero of=/root/bigfile bs=1M count=4096
