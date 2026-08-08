# No USER directive — final image runs as root. Should fail the
# runs-as-non-root assertion once the metadata-extraction stage inspects
# this image's config.
FROM debian:bookworm-slim
RUN echo "no USER directive here"
