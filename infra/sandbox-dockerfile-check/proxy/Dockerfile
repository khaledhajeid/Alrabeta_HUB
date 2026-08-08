FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends squid \
    && rm -rf /var/lib/apt/lists/*

COPY squid.conf /etc/squid/squid.conf

EXPOSE 3128

ENTRYPOINT ["squid", "-N", "-f", "/etc/squid/squid.conf"]
