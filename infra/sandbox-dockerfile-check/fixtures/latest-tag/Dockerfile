# Explicit :latest base — should fail the no-latest-tag assertion.
FROM debian:latest
RUN useradd --no-create-home --uid 10001 app
USER app
