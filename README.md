# Alrabeta Hub

The Circle's private git-native headquarters. Architecture and visual identity
are locked; Phases 0 and 1 (infra + identity) are done, running **strictly
local**, no VPS. Phase 2 (repos & commits) is next on the way to the MVP
(push → Hub → Discord).

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
cp .env.example .env   # then fill in the three FORGEJO_* secrets, see below
docker compose up -d

# 2. App
cd ../apps/web
cp .env.example .env.local   # already points at the local ports below
npm install
npm run db:push              # creates the app's tables in Postgres
```

Forgejo boots pre-installed — no install wizard. `infra/.env` needs three
generated secrets first (it's gitignored, `docker compose` picks it up
automatically since it lives next to `docker-compose.yml`):

```bash
docker compose up -d forgejo   # once, so the container exists — generate works before install too
docker exec alrabeta-hub-local-forgejo-1 forgejo generate secret SECRET_KEY
docker exec alrabeta-hub-local-forgejo-1 forgejo generate secret INTERNAL_TOKEN
docker exec alrabeta-hub-local-forgejo-1 forgejo generate secret JWT_SECRET
# paste the three values into infra/.env, then:
docker compose up -d forgejo   # restart to pick them up
```

Then create the founding admin account (self-registration is off — private
club, not a public forge):

```bash
docker exec -u git alrabeta-hub-local-forgejo-1 forgejo admin user create \
  --admin --username <you> --email <your-email> --random-password
```

That prints a one-time password — log in at **http://localhost:3300** with
it and change it from Settings → Account if you want your own.

### Registering the OAuth2 application (Better Auth ↔ Forgejo)

No API for this — Forgejo only exposes it via the web UI, so it's a one-time
manual step per environment. Log in as the admin above, go to
**Settings → Applications**, and create an application:

- Name: anything (e.g. `Alrabeta Hub (local)`)
- Redirect URIs (one per line):
  ```
  http://127.0.0.1:3000/api/auth/oauth2/callback/forgejo
  http://localhost:3000/api/auth/oauth2/callback/forgejo
  ```
- Confidential client: **checked** (this is a server-side app, not a SPA/native app)

Forgejo shows the client ID and secret exactly once. Put them in
`apps/web/.env.local` as `FORGEJO_OAUTH_CLIENT_ID` / `FORGEJO_OAUTH_CLIENT_SECRET`,
alongside a `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and
`BETTER_AUTH_URL=http://127.0.0.1:3000` — see `.env.example` for the full list.

**Use `127.0.0.1`, not `localhost`, to reach the Hub during dev.** Forgejo's
OAuth2 docs specifically warn against `localhost` for loopback redirect URIs
(RFC 8252), and Next.js's dev server separately 403s cross-origin dev
requests unless the origin is allow-listed — both are already handled
(`next.config.ts`'s `allowedDevOrigins`, both redirect URIs registered above),
but the sign-in flow only round-trips cleanly from `127.0.0.1:3000`.

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
- **Auth**: Better Auth's generic OAuth plugin against Forgejo as the
  provider (`src/server/auth.ts`). One identity for git and the Hub — no
  separate password. Session lives in Postgres (`user`/`session`/`account`/
  `verification`, owned by Better Auth — regenerate with `npx auth generate`
  after touching the plugin config, never hand-edit `auth-schema.ts`).
  Sign-in/out is wired into the nav (`src/components/auth-button.tsx`);
  `/profile` shows real session data once signed in.
- **App shell**: nav, light/dark theme (persisted, no flash).

### Bugs worth knowing about

**Forgejo's image runs two SSH servers.** The docker image runs a full
system OpenSSH daemon unconditionally (s6-supervised, for actual git-over-SSH
with `AuthorizedKeysCommand` hooks into Forgejo). Forgejo's own built-in Go
SSH server (`START_SSH_SERVER`) is a *second*, redundant option — enabling
both means they fight over the container's `:22` the moment Forgejo finishes
installing (it didn't surface in early local testing because an
uninstalled instance never initializes its built-in server at all, only
after `INSTALL_LOCK` skips the wizard). `docker-compose.yml` now leaves
`START_SSH_SERVER` off; the system sshd is the one actually serving git.

**The worker's env loading raced its own imports.** `worker.ts` originally loaded `.env.local` via an in-file `dotenv.config()`
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

No real repo/commit ingestion, no quests, no AI review, no gamification, no
VPS/TLS/domain. Those are Phases 2–8 — see the roadmap.
