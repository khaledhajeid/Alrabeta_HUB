# Alrabeta Hub

The Circle's private git-native headquarters. Architecture and visual identity
are locked; this is Phase 0/1 — running **strictly local**, no VPS, while the
MVP (push → Hub → Discord) and the sandbox judge get proven out.

## What's here

```
apps/web/         Next.js 16 app — the Hub itself, plus the worker entrypoint
infra/
  docker-compose.yml   Forgejo + Postgres + Redis, local ports only
  postgres/            init script (creates the separate `forgejo` database)
  sandbox/             C/C++ judge PoC — see infra/sandbox/README.md
```

## Prerequisites

- Docker Desktop
- Node.js 20+ (tested on 25)

## First-time setup

```bash
# 1. Infra: Forgejo + Postgres + Redis
cd infra
docker compose up -d

# 2. App
cd ../apps/web
cp .env.example .env.local   # already points at the local ports below
npm install
npm run db:push              # creates the app's tables in Postgres
```

Open **http://localhost:3300** once and click through the Forgejo install
wizard (database fields are pre-filled from the compose env; just confirm and
create your admin account — that's you, for now).

## Running it

Two processes, in separate terminals:

```bash
npm run dev      # the Hub — http://localhost:3000
npm run worker   # consumes push-events off the queue
```

`http://localhost:3000` shows a live status panel for all three local
services (Forgejo / Postgres / Redis) — that's the fastest way to tell if
`docker compose` is actually up.

## Local ports

Picked to avoid colliding with anything else that might already be running
on this machine (this dev machine already had another project's Postgres and
Redis on the standard 5432/6379).

| Service | Port | Note |
|---|---|---|
| Hub (Next.js) | 3000 | |
| Forgejo web | 3300 | maps to the container's :3000 |
| Forgejo SSH | 2222 | for `git push` once repos exist (Phase 2) |
| Postgres | 5433 | maps to the container's :5432 |
| Redis | 6380 | maps to the container's :6379 |

## What's actually wired up right now

- **Forgejo webhook intake**: `POST /api/webhooks/forgejo` — verifies the
  HMAC-SHA256 signature (`X-Forgejo-Signature`/`X-Gitea-Signature`) over the
  raw body, logs the delivery to `webhook_events`, enqueues a `push-events`
  BullMQ job. Not yet wired to an actual Forgejo webhook (that's Phase 2,
  once there's a repo to push to) — but the endpoint, signing, and queue
  pipeline are real and tested end-to-end (see below).
- **Worker**: `src/worker.ts`, run via `npm run worker`. Consumes
  `push-events`, marks the delivery processed. Phase 2 turns this into real
  commit ingestion.
- **App shell**: nav, light/dark theme (persisted, no flash), an empty
  `/profile` (fills in once Forgejo OAuth lands in Phase 1's auth step).

### A bug worth knowing about

`worker.ts` originally loaded `.env.local` via an in-file `dotenv.config()`
call. Because ES modules hoist imports above the rest of a module's
top-level code, that call ran *after* `queue.ts`/`db.ts` had already read
`process.env` at their own module scope — so the worker silently connected
to whatever was listening on the *default* Redis/Postgres ports instead of
the local containers, with no error. Fixed by loading env vars via Node's
native `--env-file` flag instead (`package.json`'s `worker` script), which
runs before the module graph loads at all. If you add a new standalone
script under `src/`, give it `--env-file=.env.local` too rather than an
in-file dotenv import.

## The sandbox judge

`infra/sandbox/` is a separate, already-validated proof of concept for the
Phase 5 "Automated Tech Lead" — a Dockerized C/C++ judge that catches memory
leaks (valgrind) and data races (ThreadSanitizer), which is what the
Violet-tier badges (`Zero Leak`, `Race Free`) will be graded on. It found and
fixed a real fail-open bug (TSan getting silently killed by Docker's default
seccomp profile). Full details, including the required `docker run` flags
for Phase 5, are in `infra/sandbox/README.md` — read that before building
the real judge worker.

## Not done yet (by design)

No auth, no real repo/commit ingestion, no quests, no AI review, no
gamification, no VPS/TLS/domain. Those are Phases 1–8 — see the roadmap.
