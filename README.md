# Alrabeta Hub

The Circle's private git-native headquarters. Architecture and visual
identity are locked; Phases 0–3 (infra, identity, repo/commit ingestion,
Discord notifications) are done, running **strictly local**, no VPS. The
original MVP — push → Hub → Discord — is live. Quests, the AI reviewer, and
gamification are next.

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
| Forgejo SSH | 2222 | `git push` — see `khaled/welcome` for a working example |
| Postgres | 5433 | maps to the container's :5432 |
| Redis | 6380 | maps to the container's :6379 |

## What's actually wired up right now

- **Forgejo webhook intake**: `POST /api/webhooks/forgejo` — verifies the
  HMAC-SHA256 signature (`X-Forgejo-Signature`/`X-Gitea-Signature`) over the
  raw body, logs the delivery to `webhook_events`, enqueues a `push-events`
  BullMQ job.
- **Repo/commit ingestion**: `src/server/ingest.ts`, run by the worker on
  every push. Real repos and commits, not a stub — see "Repos, commits, and
  reconciliation" below for the design.
- **Live activity feed**: the home page shows recent pushes and updates
  without a refresh (Server-Sent Events over a Redis pub/sub channel).
- **Repo browsing**: `/repos` and `/repos/[owner]/[name]` — list and commit
  timeline, pulled from the ingested data.
- **Auth**: Better Auth's generic OAuth plugin against Forgejo as the
  provider (`src/server/auth.ts`). One identity for git and the Hub — no
  separate password. Session lives in Postgres (`user`/`session`/`account`/
  `verification`, owned by Better Auth — regenerate with `npx auth generate`
  after touching the plugin config, never hand-edit `auth-schema.ts`).
  Sign-in/out is wired into the nav (`src/components/auth-button.tsx`);
  `/profile` shows real session data once signed in.
- **App shell**: nav, light/dark theme (persisted, no flash).

## Repos, commits, and reconciliation

`khaled/welcome` is a real repo with a real webhook — set up with:

```bash
# a service token, not a personal one — see below
docker exec -u git alrabeta-hub-local-forgejo-1 forgejo admin user create \
  --admin --username alrabeta-bot --email alrabeta-bot@localhost --random-password
docker exec -u git alrabeta-hub-local-forgejo-1 forgejo admin user generate-access-token \
  --username alrabeta-bot --token-name worker-service --scopes "read:repository,read:user" --raw
# → FORGEJO_API_TOKEN in .env.local

curl -X POST http://localhost:3300/api/v1/user/repos -H "Authorization: token <admin token>" \
  -d '{"name":"welcome","private":true,"auto_init":false,"default_branch":"main"}'
curl -X POST http://localhost:3300/api/v1/repos/<owner>/<repo>/hooks -H "Authorization: token <admin token>" \
  -d '{"type":"forgejo","config":{"url":"http://host.docker.internal:3000/api/webhooks/forgejo","content_type":"json","secret":"<FORGEJO_WEBHOOK_SECRET>"},"events":["push"],"active":true}'
```

`host.docker.internal`, not `localhost`, in the webhook URL — Forgejo runs
in the container, the Hub runs on the host, and `localhost` from inside the
container means the container itself.

**Why a bot account instead of a personal token**: the worker isn't acting
*as* whoever pushed — it's a backend service reading repo data to index it.
`alrabeta-bot` is a separate Forgejo account (currently instance-admin, so
it can read across every member's repos, private ones included) with a
token scoped down to `read:repository,read:user`. This is a placeholder for
a real permissions model — once there's a proper `alrabeta` Forgejo
organization with repos living under it, the bot should be an org member
with read access, not instance-admin. Worth revisiting before this goes
past a single-person testbed.

### The integrity model

Two schema tables carry this: `repos`/`commits` (what happened) and
`repo_refs` (a `headSha` cursor per branch — what we last knew each branch
pointed at). Commits are append-only and idempotent: unique on
`(repoId, sha)`, `ON CONFLICT DO NOTHING`, because a commit's sha is a hash
of its content — nothing about an already-seen commit ever needs updating.

Every push webhook carries a `before` SHA — what the branch pointed at
immediately prior to this push, per Forgejo. Compare that to our stored
`headSha`:

- **Matches** → clean, trust the webhook's own commit list (cheap, no
  extra API call).
- **Doesn't match** (or the branch has history we've never seen) → we can't
  trust our local view, so fall back to asking the Forgejo API directly
  what the branch actually contains and reconcile from that.

A dropped webhook (we missed a prior push) and a force push that rewrites
back past what we knew both surface as exactly this same signal — one
mechanism handles both. Superseded commits are never deleted; `commits` is
"everything ever pushed to this repo," not "the current state of the
branch," so a force-pushed-away commit just stays as history.

One more check earns its keep here, found by actually testing a force push
rather than assuming: a matching `before` only proves we didn't miss a
*prior* push — it says nothing about whether Forgejo correctly computed the
commit list for *this* one. Verified empirically that a simple
amend-and-force-push reports an accurate `commits[]`, but there's no
guarantee that holds for a more complex rewrite (this is a known rough edge
in Gitea/Forgejo-style push hooks). So there's a second, cheap check: if
the payload doesn't even contain the commit it claims is now the tip,
that's untrustworthy too — resync instead of inserting a partial picture.

**Manual recovery**: `POST /api/repos/[owner]/[name]/resync` (signed-in
users only; also a button on the repo page) re-fetches a repo's tracked
branches straight from the Forgejo API — the exact same function the
automatic reconciliation falls back to. For a repo that never got webhook
coverage at all (created before the webhook existed, or the Hub was down
through Forgejo's entire retry window), this is the way back to a correct
state.

### Why Server-Sent Events, not WebSockets

The original architecture pitch called for a WebSocket layer; this uses
SSE instead, deliberately. The activity feed is server → client only —
nothing the browser needs to send back — and SSE gets that for free from a
plain Next.js Route Handler streaming a `Response`, no new dependency, no
separate ws server process. Worker and web are different processes, so the
bridge between "worker ingested a push" and "browser tab gets notified" is
Redis pub/sub (`src/server/activity.ts`), which was already in the stack
for BullMQ. If something genuinely bidirectional shows up later — live
cursors, chat — that's the moment to reach for real WebSockets.

Activity events are also persisted (`activity_events` table), not just
published — the initial page load and anything that streams in afterward
read from the same source, so they never disagree. That table is the fix
for a real bug caught while testing: reconstructing the initial feed from
`webhook_events`' raw payload undercounted a resynced push (the payload
only lists what Forgejo itself reported, not what our backfill actually
inserted).

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

No quests, no AI review, no gamification, no VPS/TLS/domain. Those are
Phases 4–8 — see the roadmap.
