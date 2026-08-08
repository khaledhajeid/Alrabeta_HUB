FROM debian:bookworm-slim

RUN useradd --no-create-home --uid 10001 app
WORKDIR /app
COPY hello.sh /app/hello.sh
RUN chmod +x /app/hello.sh

USER app
ENTRYPOINT ["/app/hello.sh"]
