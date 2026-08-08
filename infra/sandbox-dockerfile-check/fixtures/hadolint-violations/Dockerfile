# Deliberately sloppy: unpinned base, apt-get without -y or cleanup, ADD
# for a plain local file (should be COPY), no USER. Several distinct
# hadolint rules should fire (DL3006, DL3009, DL3015, DL3020, plus our own
# runs-as-non-root check on top).
FROM debian

RUN apt-get update && apt-get install curl

ADD hello.txt /app/hello.txt
