# Alrabeta Hub — Master TODO

Single source of truth task checklist. Companion to `docs/MASTER_PLAN.md`
(the "why" and phase-level plan) — this is the "what, concretely," kept
continuously updated and checked off as work lands. Granularity increases
for the phase actually in progress; later phases stay at Master-Plan
resolution until their turn comes, rather than over-specifying design
decisions that haven't been made yet.

---

## Phase 0–5 — MVP core (done)

- [x] Phase 0: local infra (Docker Compose — Forgejo, Postgres, Redis),
      sandbox judge proof of concept
- [x] Phase 1: identity (Better Auth ↔ Forgejo OAuth2)
- [x] Phase 2: repo/commit ingestion, activity feed (SSE)
- [x] Phase 3: Discord webhook notifications
- [x] Phase 4: quests browsing/detail pages, branch-convention submission
      detection
- [x] Phase 5: sandbox grading engine (hardened `docker run`, Violet-tier
      badges, real E2E-verified)

---

## Phase 6 — DevOps Foundation & Visual Identity

### DevOps
- [x] `.github/workflows/ci.yml` — typecheck, lint, build on push to
      `main` + every PR, real Postgres/Redis service containers
- [x] Confirm CI runs green on the PR for this phase (fixed one real bug
      found on first run: `next typegen` needed before `tsc --noEmit` —
      LayoutProps/PageProps come from generated `.next/types`, which a
      fresh CI checkout doesn't have yet, unlike a local dir that's
      already run `next dev`/`build` at least once)
- [x] Enable branch protection on `main` — PR required, "build" CI check
      required, no direct push/force-push/deletion, applies to admins too.
      0 required approvals (deliberate: no second collaborator exists yet
      — requiring an approval count would deadlock every merge, since
      GitHub never allows self-approval. Revisit once there's a second
      person with write access.)
- [x] Commitlint + commit-msg git hook enforcing Conventional Commits —
      root-level `package.json`/`commitlint.config.js` (the git repo root
      isn't `apps/web`, so hook tooling lives independently of any one
      app's dependencies). Verified live: a non-conventional message was
      actually rejected, a conventional one actually passed. Also
      enforced in CI (`commitlint` job, PR-only, lints the full base..head
      range) since a local hook alone doesn't stop `--no-verify`.
- [x] GitHub issue templates (bug/feature — structured YAML forms), PR
      template
- [x] Labels: Path (`path: git/bash/docker/systems/backend-api/cicd`),
      phase (`phase-6`…`phase-13`, descriptions updated 2026-08-09 to match
      the renumbering in `docs/MASTER_PLAN.md` decision 10, `phase-12`/
      `phase-13` newly created), type (`chore` added; `bug`/`enhancement`
      already existed as GitHub defaults, reused rather than duplicated),
      priority (`priority: high/medium/low`) — 23 total, verified via
      `gh label list`
- [ ] GitHub Projects board, milestones mapped to Phases 6–13
- [x] Lightweight `CODEOWNERS`

### Visual identity — decisions (locked, see MASTER_PLAN §2)
- [x] Register: Vercel/Linear/Raycast, premium minimalist
- [x] Theme: strict dark default (not OS-preference-following), light
      stays as explicit opt-in
- [x] Accent: Violet/Deep Purple as primary brand color, kept distinct
      from the existing green "live/success" status color
- [x] Type: JetBrains Mono (already wired) for code, Geist for UI
      (replacing IBM Plex Sans)
- [x] No bilingual/RTL scope
- [x] Logo assets received (full lockup + icon-only mark)

### Visual identity — execution
- [x] `apps/web/src/components/logo.tsx` — `Logo` (full) and `LogoIcon`
      React components, `currentColor` fill so they track the theme
- [x] `apps/web/src/app/icon.svg` — fixed-color favicon (browser chrome
      isn't in page theme context, needs a committed color)
- [x] Install `geist` package, wire `GeistSans` into `src/fonts/index.ts`
      as `--font-sans`, replacing IBM Plex Sans
- [x] Redesign `globals.css` tokens: charcoal/near-black bg (violet-tinted
      neutral, not flat gray), stark-white text, violet `--accent`
      (promoted from `--rare`), green `--signal` retuned to fit the new
      palette without losing its distinct "status" meaning
- [x] `theme-script.tsx` + `theme-toggle.tsx` default logic: dark is the
      true default absent an explicit stored choice, not
      `prefers-color-scheme`-derived (fixed a stale OS-fallback in
      `theme-toggle.tsx`'s `getSnapshot` found while doing this)
- [x] Apply across every existing surface: home (`page.tsx`), nav
      (`nav.tsx`, `mobile-menu.tsx`), quests (`quests/page.tsx`, quest
      detail), repos (`repos/page.tsx`, repo detail), profile
- [x] Logo wired in: `LogoIcon` in mobile nav/favicon, `Logo` in desktop
      navbar
- [x] Primary CTA (`auth-button.tsx`'s "Sign in") upgraded to a filled
      `--accent-strong` button — the brand accent was otherwise invisible
      on the homepage, the single most prominent actionable element
- [x] Contrast verified computationally (Playwright + browser luminance
      math): dark (default) 18:1/7.4:1/7.2:1/5.7:1 across text/muted/
      accent/button-text; light passes AA too, tightest margin 4.60:1
- [x] Playwright pass at 375/768/1280px, both themes, console-checked —
      home, quests, quest detail (code block + syntax highlighting),
      repos, profile
- [x] `docs/DESIGN.md` written — token table, type scale, logo usage rules

---

## Phase 7 — Quest Runner & Content Buildout

- [x] Schema: `quests.runner` enum (sandbox-exec/io-match/dockerfile-check/
      git-assert) + `quests.runnerSpec` jsonb. Also replaced
      `quest_submissions`'s (questId, userId) index with a covering
      (questId, userId, submittedAt) index for the badge-eligibility "first
      submission" query — validated against Postgres docs (equality columns
      first, sort column last, avoids a separate sort step)
- [x] Runner-type abstraction: `judge.ts` is now an orchestrator
      (fetch → extract → dispatch), `src/server/runners/` holds one module
      per runner type + a shared discriminated `JudgeVerdict` union
- [x] Extracted the existing C/C++ sanitizer flow into `runners/sandbox-exec.ts`
      unchanged (Phase 5's hardened flag set and Violet-tier logic intact —
      re-verified via real E2E, not just "the diff looks like a pure move")
- [x] Implemented `io-match` runner: new `infra/sandbox-io-match/` image
      (bash/python3/node, non-root, no custom seccomp needed — validated
      against Docker's stock default profile), `runner.sh`, fixtures for
      all three interpreters. Found and fixed a real bug before trusting it
      (a `jq` call missing `-n` silently produced zero output under closed
      stdin — see the image's README) — same fail-open shape as Phase 0/5's
      bugs, same discipline caught it
- [x] BullMQ queue split by runner type (`grading-queue.ts`), each with
      independently tuned concurrency (sandbox-exec: 2, io-match: 8) —
      validated against BullMQ's own docs (shared Redis connection across
      multiple Queue/Worker instances is the documented pattern; concurrency
      is per-Worker, so different concurrency per runner type needs
      different queues, not job-name branching within one). Found and fixed
      a real bug: BullMQ queue names can't contain `:`, caught by `next build`
      failing at page-data-collection time, not by inspection
- [x] Enqueue routing fixed to be runner-based, not tag-based — tags
      (memory/multithreading) only ever decided *badge* eligibility, not
      gradability; an io-match quest has neither tag and still needs
      grading. Removed the now-dead `GRADABLE_TAGS` export accordingly
- [x] Real E2E test: `extract-failed-logins` (new Bash Foundations quest)
      pushed as a genuinely corrupted script first (found honestly, not
      staged — see PR) → graded `verdict: "failed"` with the exact
      actual-vs-expected diff; pushed again fixed → `verdict: "violet"`,
      `status: "passed"`, correctly zero badges (Foundations quests aren't
      badge-eligible — that's gated by quest tags, unaffected by this work)
- [x] `dockerfile-check` security PoC — `infra/sandbox-dockerfile-check/`.
      Rejected Docker-in-Docker entirely (no privileged flag, no daemon,
      no Sysbox host dependency) in favor of Kaniko (unprivileged,
      daemonless build) plus a squid egress-allowlist sidecar the build
      container reaches through a Docker `--internal` network with no WAN
      route of its own. 9/9 fixture-validated (`./poc-test.sh`), including
      proving the boundary is the missing WAN route and not just the
      `HTTPS_PROXY` env var, since a variant that explicitly `unset`s it
      inside the `RUN` step still fails, for a network reason not a proxy
      403. Found 6 real bugs before trusting it: wrong CDN hostname,
      Kaniko not forwarding `-e` env vars into `RUN` steps (needs
      `--build-arg` instead), busybox `wget` not tunneling HTTPS through a
      proxy, `skopeo`'s `User` field being absent rather than empty for
      root images, a `/dev/shm`-quota fixture that was accidentally
      testing the wrong mechanism, and a dev box missing
      `timeout`/`gtimeout`. See the README for detail on each.
- [x] `dockerfile-check` full integration — `runners/dockerfile-check.ts`
      wired into `judge.ts`/`grading-queue.ts`/`judge-worker.ts` following
      the same pattern as the other three runners, no custom judge image
      needed since Kaniko and hadolint are upstream images doing exactly
      what's needed. `infra/docker-compose.yml` gained the
      `dockerfile-check-proxy` service and the pinned-name
      `dockerfile-check-internal` network (promoted straight from the PoC,
      dropping the `-poc-` naming). Assertion set: `builds-successfully`,
      `runs-as-non-root`, `no-latest-tag`, `image-size-under`,
      `hadolint-clean`, `has-healthcheck`. Real E2E verified against the
      live compose stack, not just fixtures: a clean Dockerfile graded
      `violet` (all 5 checks), an unpinned root-running Dockerfile graded
      `failed` with per-check detail, and the PoC's exfiltration attempt
      re-run through the actual production wiring still hit the same
      squid 403, confirming the containment boundary holds end to end,
      not just inside the standalone harness. New seeded quest:
      `containerize-it-right` (Docker Foundations track).
- [x] `dockerfile-check` bugfix: `has-healthcheck` was silently unable to
      ever pass. `skopeo inspect --config` was the original source for
      image metadata, and it turns out to drop the `Healthcheck` field
      entirely, even when a real `HEALTHCHECK` instruction produced one,
      confirmed by extracting the raw OCI config blob directly from the
      tarball and finding it correctly present there. Found while
      building a quest around this exact assertion, before it shipped,
      not after. Fixed by reading the raw config blob directly
      (`manifest.json` -> `Config` digest -> that file) instead of
      shelling out to skopeo at all, which also drops skopeo as a
      dependency entirely. Re-verified the existing pass/fail paths for
      no regression, then the healthcheck-present and healthcheck-absent
      cases both graded correctly for the first time.
      All four Foundations tracks now have a working runner.
- [x] Implement `git-assert` runner — a genuinely different trust model
      than `sandbox-exec`/`io-match`: it doesn't execute anything the
      submitter wrote, it inspects real git history (commit count, merge
      structure, message conventions) via `git log`/`rev-list`/`cat-file`.
      That needed a real `git clone` (all branches, full history — a
      tarball snapshot can't provide ancestry), done on the host with the
      same trust boundary as the existing archive download, with the
      Forgejo token passed via a credential-helper shell function reading
      an env var so it never appears in host process argv (`ps aux`). Only
      the *inspection* step (git plumbing against the cloned repo) runs in
      the hardened `--network none` container — new
      `infra/sandbox-git-assert/` image, fixture-validated before trusting
      it, found two real bugs first: `git config --global` silently failed
      into stderr (the non-root `judge` user has no `$HOME` to write
      `.gitconfig` to — fixed with `GIT_CONFIG_GLOBAL` pointed at the
      already-writable `/tmp`), and `git rev-parse --verify` accepts the
      all-zero SHA as git's "null object" sentinel and reports it as
      "verified" even though no such commit exists — a real fail-open,
      fixed by switching to `git cat-file -e <sha>^{commit}`. Both bugs
      are documented in the image's README, same as every prior runner's
      bug narrative. Assertion DSL kept small for v1: `no-merge-commits`,
      `commit-count` (eq/min/max), `commit-message-matches` (regex) —
      covers the master plan's original examples without over-building
- [x] Real E2E, against the actual Forgejo instance and real existing
      commits (not fixtures): the same commit graded `failed` with an
      accurate diff (2 commits found vs. 3 expected, one message not
      matching the pattern) under a strict spec, and `violet` under a
      spec it actually satisfies — full pipeline (host clone with the
      real credential path, sandboxed inspection, JSON verdict parsing)
      validated end to end before trusting it
- [x] Seeded a real quest: `three-clean-commits` (Git track, Foundations,
      30pts) — "shape your history into exactly three Conventional-Commits
      commits, no merges"
- [x] `io-match` bugfix: `runner.sh` fed submitted scripts' stdin through
      a bash variable (`STDIN=$(jq -r '.stdin')`), and command
      substitution unconditionally strips trailing newlines, so a
      perfectly correct submission using `while read` would silently lose
      its last input line whenever a case's stdin ended with one. Found
      while writing a fixture for a new quest, not in production, but the
      already-live `extract-failed-logins` quest runs through the exact
      same code path. Fixed by writing stdin to a file with `jq -j` and
      redirecting from that instead of a variable; covered going forward
      by a dedicated `fixtures/multiline-stdin.sh` fixture. See the
      runner's README for the full writeup.
- [x] Content buildout: every Foundations track now has 3 quests,
      matching C/C++'s existing depth, instead of the single proof point
      each of Bash/Git/Docker had before. New quests: `tally-the-status-codes`
      (medium, io-match, aggregation over per-line filtering), `group-the-sessions`
      (hard, io-match, stateful multi-line parsing with `declare -A`),
      `no-giant-commits` (medium, git-assert, first real use of
      `commit-count`'s `min` op, only `eq` had been fixture-tested before),
      `scoped-and-squashed` (hard, git-assert, `max` op plus a stricter
      `type(scope): message` pattern), `slim-it-down` (medium,
      dockerfile-check, a 50MB cap instead of 200MB), `ship-it-with-a-healthcheck`
      (hard, dockerfile-check, `has-healthcheck` as the headline
      assertion). Writing `group-the-sessions`' reference solution is what
      surfaced the `io-match` trailing-newline bugfix above, and building
      `ship-it-with-a-healthcheck` is what surfaced the `dockerfile-check`
      `has-healthcheck` bugfix, both real correctness issues found by
      building content, not by auditing the runners directly. Every new
      quest validated pass and fail (and for the two git-assert quests,
      one message-format failure specifically) against its exact seeded
      `runnerSpec`, pulled from the real database, not a hand-copied
      approximation of it.
- [x] Paths relational schema (`docs/MASTER_PLAN.md` §3.5): new `paths`
      table (slug/title/summary/status/authorId), new `path_quests` join
      table (`pathId`, `questId`, `orderIndex`, unique on both
      `(pathId, questId)` and `(pathId, orderIndex)`, indexed on
      `(pathId, orderIndex)`), new `quests.style` enum
      (`"educational" | "pure"`, defaults to `"pure"` only so `db:push`
      doesn't need an interactive per-row prompt — every existing quest
      gets an explicit, deliberately-chosen value in the retrofit below,
      not left to the default). Pushed live via `drizzle-kit push`
      (this project's schema-push workflow, no separate migration file to
      track), verified directly against Postgres (`\d paths`/`\d
      path_quests`/`\d quests`), not just "the push command exited 0"
- [x] Retrofit: every one of the 12 existing quests actually read for its
      real style, not defaulted or guessed for balance. Result: 11 `pure`,
      1 `educational` (`the-careless-counter` — its prompt explains the
      race-condition mechanism itself, "counter++ is a read, an
      increment, and a write...", a real concept primer before the
      challenge; none of the other 11 do, they frame the problem or point
      externally, which is `pure` by definition, not `educational`). An
      honest empirical finding, not force-fit for variety — genuinely
      `educational` content is a gap for future authoring (Phase 11), not
      something to manufacture retroactively
- [x] First real Mastery Path seeded: `backend-engineering-foundations`,
      all 12 quests, ordered **tier-interleaved across all four tracks**
      (every easy quest, then every medium, then every hard) rather than
      track-blocked (all of Git, then all of Bash, ...) — per §1.5's
      interleaved-practice research citation, spacing different skills
      within a sequence measurably beats block formats. Git leads every
      tier (§1's "flagship track, not filler" finding), C/C++ trails
      every tier (§1's framing as the existing differentiator folded into
      this launch Path). Verified idempotent: re-running
      `db:seed-quests` twice left `path_quests` at exactly 12 rows both
      times
- [x] Functional Paths browsing UI on `/quests`: the path renders as an
      ordered, numbered list (sequence matters, unlike a browsable grid),
      any quest not in a published path renders in a "Standalone" grid
      below it (currently empty — all 12 quests are in the one path —
      the code path is real and exercised by the empty-state branch, not
      unreachable). Tag filtering kept, now scoped across both the path
      list and the standalone grid. Verified live in a real browser, not
      just `tsc`/build: all 12 quests render in the correct tier-
      interleaved order, the one `educational` quest is visibly
      distinguishable from the 11 `pure` ones, tag filtering and the
      quest-detail link both still work. One real finding along the way
      that turned out not to be a product bug: hard/direct URL
      navigation via the browser-automation tool intermittently left a
      stale `InvalidStateError: Transition was aborted` from React's
      `<ViewTransition>` wrapper, which visually looked like missing
      quests in a screenshot — ruled out as a real defect by confirming
      the DOM had all 12 items at `opacity: 1` via direct inspection,
      and by reproducing the identical stuck-overlay artifact on the
      untouched home Activity feed page; real in-app `Link` clicks (the
      actual user path) never showed it

**Phase 7 closed** (2026-08-09) — quest runner engine (all four runners),
Backend Engineering Foundations content (12 quests across 4 tracks), and
a real Paths structure (schema + first Mastery Path + browsing UI) all
shipped. Phase 7.5 is done too (16/40 → 26/40, re-audit-verified, see
below). Phase 8 (Learning UI/UX) is next.

**Phase 8 closed** (2026-08-09), see the Phase 8 section below for the
full checklist and the two real bugs its dual-agent exit-gate audit
caught and fixed. Phase 9 (Gamification Expansion) is next.

---

## Phase 7.5 — UI/UX Redesign (A-to-Z)

*Inserted ahead of the rest of Phase 7 per explicit direction. Triggered by
a `/impeccable critique` dual-agent audit (2026-08-08,
`.impeccable/critique/2026-08-08T15-06-42Z__apps-web-home-nav-quests-quest-detail.md`,
score **16/40 — Poor**) that confirmed the complaint with hard evidence: one
`transition-colors` rule in the entire codebase and nothing else, one
`shadow-lg` in the whole app, a 56px nav with an ~24px-tall logo whose
wordmark is functionally illegible, and zero rendered trace anywhere of the
badge/tier system that gave `--accent` its name. Full findings and the
benchmark research (Vercel/Linear/Raycast/Supabase design-system specifics)
are in `docs/MASTER_PLAN.md` §2.5. Executed as lettered sub-phases in order
— each is a real gate, not a suggestion, per the project's standing "peak
potential before moving on" rule.

**Closed out 2026-08-08.** All eight sub-phases shipped across four PRs
(#17–#20). Closing re-audit (dual-agent, same rigor as the opening one,
`.impeccable/critique/2026-08-08T18-28-15Z__apps-web-home-nav-quests-quest-detail.md`):
**16/40 → 26/40 (Poor → Acceptable)**, every original finding verified
fixed live by an independent agent, not taken on faith from the changelog.
Lighthouse on a production build: 95/100 performance, 100/100
accessibility, 0 CLS. One real gap deliberately deferred rather than
scope-crept into this phase: the submission-status row doesn't self-update
(no SSE/polling) — real-time infrastructure work, not UI polish; revisit
alongside Phase 9 (Gamification) or whenever submission UX gets its own
slice.

### 7.5.A — Motion & elevation foundations (tokens first, no visual change yet)
- [x] Elevation scale added to `globals.css`: `--shadow-resting`/
      `--shadow-raised`, violet-tinted, theme-aware (separate dark/light
      values, same pattern as the existing color tokens), mapped into
      `@theme inline` as `shadow-resting`/`shadow-raised` Tailwind
      utilities — not applied to any surface yet, that's 7.5.D
- [x] Motion tokens: `--motion-fast` (120ms), `--motion-base` (180ms),
      `--motion-slow` (280ms), `--ease-out-quint` (`cubic-bezier(0.22, 1,
      0.36, 1)`, registered in `@theme` so `ease-out-quint` is a real
      Tailwind utility) — validated against Tailwind v4's docs first:
      `--ease-*` is a real theme namespace, `--duration-*` isn't (durations
      use the `duration-(--var)` CSS-var syntax instead)
- [x] Semantic z-index scale (`--z-dropdown` through `--z-tooltip`) added
      and the one hardcoded `z-20` in `mobile-menu.tsx` replaced with
      `z-(--z-dropdown)` — verified live, the dropdown still renders above
      page content correctly
- [x] `prefers-reduced-motion` global safety net written into `globals.css`
      now, before 7.5.C adds anything for it to reduce

### 7.5.B — Identity fix: nav + logo
- [x] Nav height `h-14` (56px) → `h-16` (64px)
- [x] Logo rebuilt as two independently sized pieces — `LogoIcon`
      (unchanged) + a new `Wordmark` component (the same wordmark paths,
      re-cropped to their own tight viewBox) — composed via flexbox in
      `nav.tsx` rather than as one fused multi-transform SVG, which turned
      out to be the more robust way to keep both pieces legible across
      breakpoints
- [x] Mobile nav shows icon + wordmark (previously icon-only) — found and
      fixed a real regression first: the initial size (matching desktop)
      overflowed the 375px row by 22px once the auth button, theme toggle,
      and menu trigger were all present. Measured with `scrollWidth` vs.
      `innerWidth`, not eyeballed — reduced padding/gap and the wordmark's
      mobile size until `scrollWidth === innerWidth` at 375px, confirmed
      with a real screenshot that it's still legible at the smaller size
- [x] Logo touch target: the link's hit area is now 44px tall (`py-2`
      around the 28px icon) and well over 44px wide at every breakpoint —
      verified via `getBoundingClientRect()`, not assumed
- [x] Verified: `tsc --noEmit`, `lint`, `next build` all clean; Playwright
      pass at 375/768/1280px, both themes, on home and quests; zero
      horizontal overflow, zero console errors, mobile menu dropdown still
      renders correctly above content with the new z-index token

### 7.5.C — Motion applied
- [x] Hover/focus micro-interactions beyond color: quest/repo/commit rows
      get a `translate-x-0.5` nudge on hover alongside the existing
      background change; every button (sign-in CTA, sign-out, resync,
      theme toggle, mobile menu trigger) and tag-filter pill gets
      `active:scale-9{0,5}` press feedback — all on `--motion-fast` +
      `--ease-out-quint`, all real CSS `transition`s, nothing JS-driven
- [x] Route/page transitions: React's `<ViewTransition>` (works with the
      App Router with no extra config — confirmed by reading Next's own
      `node_modules/next/dist/docs` guide first, since AGENTS.md warns this
      version's APIs may not match training data) via a new
      `route-transition.tsx` client wrapper keyed on `usePathname()`,
      wired into `layout.tsx` around `{children}`. Deliberately a plain
      crossfade, not a directional slide — this is a product surface with
      a flat nav, not a gallery drill-down, and the product register is
      explicit that motion here should read as "the route changed," not
      stage a page-load moment. The nav itself is anchored with
      `viewTransitionName: "site-header"` plus the CSS from Next's own
      guide so it never appears to move or refade. Added the
      `::view-transition-*` reduced-motion coverage the existing global
      rule structurally can't reach (pseudo-elements, not real DOM nodes —
      also straight from Next's guide, not guessed)
- [x] List entrances (activity feed, quest catalog, commit history) stagger
      in via a `.reveal-list` CSS class + `nth-child` delays, capped at the
      first 8 rows — one deliberate reveal, not a uniform reflex, and nth-
      child keeps it pure CSS with no per-item JS delay calculation
- [ ] Submission-result state gets a real entrance — deferred to 7.5.F,
      where the visual redesign this motion serves actually gets built

### 7.5.D — Depth applied
- [x] Replaced bare `border` with the 7.5.A elevation scale on every
      genuinely raised surface: the nav header, the mobile-menu dropdown
      (now `shadow-raised` instead of Tailwind's generic `shadow-lg`), the
      four list *containers* (activity feed, quest catalog, repo
      directory, commit history), the quest-detail "how to submit" card,
      and the profile avatar card. Rows inside the lists keep their
      `divide-y` borders — still genuinely tabular content, per the
      original carve-out — only the containers moved from flat border to
      elevation. The quest-detail submissions list is untouched here too,
      for the same reason its motion is deferred: that's 7.5.F's surface
      to redesign, not this pass's

### 7.5.E — Information hierarchy & content differentiation
- [x] Real type scale applied deliberately (Tailwind's own default scale
      already fits a product register's tight-ratio guidance — the fix was
      consistent *use*, not new tokens): catalog-card titles promoted to
      `text-base font-semibold` (16px/600), metadata standardized on
      `text-xs` (12px), summaries stay `text-sm` (14px) — a real 3-step
      hierarchy instead of everything sitting in the same band
- [x] Quest catalog and repo directory are now card grids
      (`grid-cols-[repeat(auto-fill,minmax(260px,1fr))]`), each with a
      distinct card shape for what the entity actually is (points+tags vs.
      private-badge+branch) rather than the same row template reused
      verbatim. Activity feed is a real timeline now — a connecting line
      between nodes, sitting directly on the page canvas instead of inside
      a bordered box, since the line does the grouping work a border used
      to. Commit list is untouched structurally, correctly — still
      genuinely tabular, only got the 7.5.D/E typography touch (message
      promoted to `font-medium`)
- [x] Verified responsive: card grids collapse to one column at 375px with
      zero horizontal overflow (`scrollWidth === innerWidth`, not eyeballed)

### 7.5.F — Gamification made visible (UI only — no new schema/currency)
- [x] Submission result redesigned: a new `SubmissionStatus` component —
      icon + color + `font-semibold`, using `--signal`/`--danger` (state,
      not brand — same distinction `DESIGN.md` already draws for the
      status dots) instead of a plain text row. Wrapped in `reveal-list`,
      fulfilling the entrance 7.5.C deliberately deferred here
- [x] A minimal badge/tier display now exists: new `BadgePill` component
      (spark icon, violet, matching the existing `systems`-tag treatment)
      surfaced on the profile page (real query against the `badges` table,
      honest empty state if none yet) and on quest detail (badges earned
      per submission, plus a "solve this clean to earn X" hint shown
      *before* the quest is ever solved — the badge system used to be
      invisible until you'd already earned one blindly). New
      `lib/badge-info.ts` holds display metadata, deliberately kept
      separate from `server/badges.ts`'s grading/eligibility logic so the
      UI layer doesn't import server-only types. Two-currency/streaks/shop
      untouched, exactly where they already were — Phase 9 (Gamification)
- [x] Tone lock held: a spark icon and a checkmark, not a trophy or a
      confetti burst — verified against the actual rendered result, not
      just intended
- [x] `BadgePill`'s accent-on-tint contrast verified computationally (real
      browser luminance math, same method as Phase 6): dark 6.44:1, light
      4.68:1 — both clear AA (4.5:1), light with a real but not generous
      margin, noted honestly rather than rounded up

### 7.5.G — Accessibility & robustness (fixes the audit found directly)
- [x] `--ember` light-mode contrast bug fixed: was 3.39:1, orange-600 →
      orange-700 clears it at 4.94:1 (verified live post-fix, not just
      computed in isolation). `DESIGN.md` corrected to match what's
      actually live (it's a real syntax-highlight color, not "reserved")
- [x] Service-status dots get an `sr-only` text alternative
      ("Forgejo — operational"/"down") alongside the existing color dot —
      confirmed present in the actual accessibility tree by the re-audit,
      not just in source
- [x] Mobile menu gets a focus trap (Tab/Shift+Tab confined to trigger +
      panel, wraps at both ends) and an Escape handler (closes, returns
      focus to the trigger) — verified with real scripted keyboard testing
      by the re-audit: Tab from the last link wraps to the trigger, Escape
      closes and refocuses correctly
- [x] Tag-filter pill wall collapses to a native `<select>` past 6 tags —
      verified live against real data: 9 tags in the actual seeded
      content, correctly rendering the select instead of pills
- [x] `loading.tsx` (skeleton blocks, not a spinner) and `error.tsx`
      (styled retry, no raw error-message echo) added at the app root
- [x] Both avatar renders (`profile/page.tsx`, `auth-button.tsx`) use
      `next/image` with real `alt` text; `next.config.ts` derives the
      allowed remote host from the same `FORGEJO_URL`/`FORGEJO_PUBLIC_URL`
      env vars the rest of the server already reads

### 7.5.H — Verification
- [x] Full Playwright pass, 375/768/1280px, dark theme on every touched
      surface (home, quests, quest detail, repos, repo detail, profile) +
      light-theme spot checks on the pages carrying real color changes —
      zero horizontal overflow, zero console errors anywhere
- [x] Contrast re-verified computationally, real browser luminance math —
      and it caught a second real bug: **`--signal` also failed AA in
      light mode** (3.59–3.77:1, the same failure class as `--ember`,
      hitting the brand-new `SubmissionStatus` "Passed" text directly).
      Fixed the same way: emerald-600 → emerald-700 (5.23–5.48:1),
      verified live post-fix
- [x] Performance budget: Lighthouse against a production build — **95/100
      Performance, 100/100 Accessibility, 0 CLS** on home/quests/quest-
      detail. Motion and elevation cost nothing measurable; no "before"
      snapshot exists to diff against (no stashed pre-redesign build), so
      this is a verified-good current state, not a literal before/after
      delta — noted honestly rather than implying a comparison that wasn't
      actually run
- [x] Re-ran `/impeccable critique` as a genuine dual-agent re-audit (not
      a rubber stamp) — **score moved 16/40 → 26/40 (Poor → Acceptable)**.
      Both agents independently verified every one of the four originally-
      named findings fixed *live*: motion is real and respects reduced-
      motion (including the `::view-transition-*` pseudo-element edge case
      most implementations miss), elevation is applied to 9 real surfaces
      (was 1), the nav/logo are legible and hit a real 44px touch target,
      and the badge/gamification system renders with real data. The
      re-audit also caught two things this phase had missed: the
      `--signal` bug above, and the activity-feed's "live" indicator dot
      repeating the exact color-only-with-no-text-alternative bug this
      same sub-phase fixed for the service-status dots — both fixed
      immediately, not deferred, since they're the same bug class this
      sub-phase exists to close out. `BadgePill`'s description (previously
      `title`-attribute only, unreliable for screen readers and
      unavailable on touch) also got a real `sr-only` alternative.
      **Deliberately not fixed, logged as a follow-up instead**: the
      submission-status row doesn't self-update (no SSE/polling, unlike
      the activity feed) — a real gap, but real-time infrastructure work,
      not UI/motion/accessibility polish; revisit alongside Phase 9
      (Gamification) or whenever submission UX gets its own slice. Also
      noted, lower priority: sparse card grids read as empty at low item
      counts on wide viewports, and difficulty labels have no visual
      coding beyond text —
      both P3/opinion-level, not correctness bugs
- [x] `docs/DESIGN.md` rewritten to v2: elevation, motion, z-index, type
      scale, the new `LogoIcon`+`Wordmark` composition, the three layout
      patterns (card grid / timeline / tabular), the gamification
      components, and the accessibility conventions this sub-phase
      established — all documented, not just shipped

---

## Phase 8 — Learning UI/UX ✅ done

*New, inserted 2026-08-09. Needs Phase 7's retrofitted Mastery Path to
design against, not placeholder content. Same relationship to Phase 7
that 7.5 had to Phase 6 — see `docs/MASTER_PLAN.md`'s Phase 8 entry for
the full rationale. Closed out 2026-08-09.*

- [x] Research pass (firecrawl): progressive disclosure (Nielsen Norman
      Group's term for "hints behind a reveal, not shown inline") and
      stepper/timeline UI conventions, before writing any code
- [x] Educational vs. Pure visual distinction: `quest-primer.tsx` (a
      distinct `bg-surface-2` "Before you start" callout above the
      challenge, closed the moment it's read) for the one Educational
      quest; `research-hints.tsx` (a closed-by-default native `<details>`
      panel below the challenge) for Pure quests' keyword pointers, so
      the hint reads as opt-in rather than a disguised tutorial; a shared
      `quest-style-badge.tsx` (book/compass icon) on both catalog cards
      and the detail page
- [x] Mastery Path progression UI: `path-step-dot.tsx` adapts the
      existing activity-feed connecting-line/dot-node shape to a step
      sequence: passed (signal checkmark), current position (accent
      ring, gated on a real signed-in session), difficulty fade via
      `--accent` border opacity across the tier-interleaved order
- [x] Exit gate: dual-agent `/impeccable critique` (two isolated
      sub-agents, neither saw the other's output), same methodology 7.5
      used to close. Found and fixed two real bugs, not a changelog taken
      on faith:
      - a pre-existing, app-wide CSS bug (`globals.css`'s
        `* { border-color: var(--line) }` was unlayered, so it beat every
        layered `border-{color}` Tailwind utility regardless of
        specificity, already silently flattening `BadgePill`'s and the
        `systems` tag's violet borders before this phase). Fixed with
        `@layer base`
      - the "current step" ring rendering for signed-out visitors (not
        gated on `session`). Fixed
      Score: 30/40 pre-fix → ~38/40 post-fix, re-verified live after
      both fixes

---

## Phase 8.5 — Paths Information Architecture & Home Redesign ✅ done

*Inserted 2026-08-09, triggered by direct user critique of the shipped
Phase 8 UI. See `docs/MASTER_PLAN.md`'s Phase 8.5 entry and decision 13
for the full rationale (root cause: `paths` to `quests` is only two data
tiers, so there is no queryable "Git track" vs "Bash track", only
informal tags).*

- [x] `tracks` table + migration: `paths` (category tier, unchanged),
      `tracks` (new, own `trackIcon` enum), `track_quests` (new join,
      fully replacing Phase 7's `path_quests`). Pushed live, verified
      against Postgres directly
- [x] Re-cut `backend-engineering-foundations`'s 12 quests into 4 real
      tracks (Git, Bash/Linux, Docker, C/C++), each internally
      difficulty-ordered, real per-track summary copy, cross-track
      interleaving dropped as no longer needed
- [x] `/impeccable shape` for the Paths hub: category cards, track cards
      (icon, quest count, per-track progress), track detail (the
      existing Phase 8 stepper against a real single-skill sequence).
      Full discovery interview + structured brief, user-confirmed
- [x] `craft` the Paths hub: `/paths`, `/paths/[pathSlug]`,
      `/paths/[pathSlug]/[trackSlug]`, 4 new hand-drawn track icons
      (`track-icon.tsx`), `/quests` narrowed to standalone/search, nav
      gained a "Paths" link
- [x] Exit gate for the Paths hub: dual-agent `/impeccable critique`.
      Found and fixed 3 real issues, see `docs/MASTER_PLAN.md` decision
      14 for full detail:
      - difficulty-tier border encoding that structurally couldn't clear
        WCAG contrast across its own gradient (opacity-based, now
        width-based; also caught a real Tailwind bug where color without
        an explicit width utility renders no border at all)
      - undifferentiated track cards (now surface each track's real
        grading method as a caption)
      - `/quests` silently duplicating `/paths`' content (now shows
        "Part of [Track]" per quest)
      Score: 30/40 pre-fix → ~36/40 post-fix. 2 P3s deliberately deferred
      (lateral track-to-track nav, single-path sparseness)
- [x] `/impeccable shape` for the Home dashboard: two real states (decision
      15), not one. Signed-in: progress across active paths/tracks,
      points/rank, continue-where-you-left-off, Daily/Standalone quests;
      activity feed demotes to a secondary module or its own `/activity`
      route. Signed-out: what this platform is, who it's for, sign-in
      CTA, currently a stranger lands on the same raw internal activity
      feed a signed-in user does
- [x] Nav/logo pass: icon mark illegible at 28px nav scale, nav shell
      lacks elevation/blur-on-scroll relative to the Vercel/Linear/
      Raycast register the rest of the system commits to
- [x] Custom `not-found.tsx` (decision 15): `notFound()` calls today fall
      through to Next's generic default 404, breaking the register every
      other screen commits to; cheap enough to fold in here
- [x] `craft` the Home dashboard (both states), nav/logo pass, and the
      custom 404: signed-in dashboard shows a real computed points total
      with no rank (Phase 9's leaderboard doesn't exist yet), "Daily
      quests" became "standalone quests" (no daily-rotation mechanic
      exists, building one now would be new scope), `/activity` is a new
      dedicated route for the old home page's live feed, `LogoIcon` is a
      new single-shape chamfered-square mark replacing an illegible
      multi-path illustration, nav is sticky with backdrop-blur and
      scroll-driven elevation. Inline-nav breakpoint moved from `sm:` to
      `lg:` mid-build after finding real overflow at 640px and 768px
- [x] Exit gate for the Home dashboard, nav/logo pass, and 404: same
      dual-agent `/impeccable critique` methodology. Found and fixed 2
      real issues, see `docs/MASTER_PLAN.md` decision 16 for full detail:
      a mobile-menu with no way to dismiss by clicking away (breakpoint
      move widened who hits it), and a points stat with no explanation
      anywhere on the page. Score: 32/40, detector scan clean

---

## Phase 9 — Gamification Expansion *(was Phase 8)*

- [ ] Design the two-currency model (permanent points/rank vs. spendable
      shop currency) and the schema it needs
- [ ] Streak tracking, computed off submission history
- [ ] Shop v1: cosmetic items (profile flair, title, activity-feed
      feature), admin-addable manual/"real-world" reward line items
- [ ] Discord role integration at point thresholds (extends the existing
      webhook integration)
- [ ] Post-solve peer solution visibility (once passed, see others'
      accepted solutions for that quest)
- [ ] Leaderboard route (decision 15): the two-currency system above has
      no page that surfaces rank against other people; without one,
      "rank" is only ever visible on your own profile. Standard on every
      comparable platform (LeetCode, HackerRank, Codecademy); depends on
      this phase's own currency work, so it belongs here

---

## Phase 10 — Admin Panel *(was Phase 9)*

- [ ] `role` field on `user` (admin/member), auth guard for admin routes
- [ ] User list + role management UI
- [ ] Quest CRUD UI (retires `scripts/seed-quests.ts` as the only way to
      publish a quest)
- [ ] **Path CRUD UI** (author/order/publish a `paths` row and its
      `path_quests` membership — Paths are a first-class entity per §3.5,
      not a tag)
- [ ] Submissions/grading monitor — check whether an existing OSS queue
      dashboard (e.g. Bull Board) covers this before building custom
- [ ] Audit log (append-only table + admin actions wired to log to it)

---

## Phase 11 — Market-Driven Content

*New, inserted 2026-08-09. Sequenced after Admin (10, real CRUD tooling
for content at this scale) and after Learning UI/UX (8, content authored
directly against the final presentation model). Full rationale in
`docs/MASTER_PLAN.md`'s Phase 11 entry.*

- [ ] Research pass: `firecrawl`/`context7` against current official
      documentation and named industry-standard sources to identify
      quest-shaped, high-demand skills — same source-quality bar as §1's
      original market research, not blog-post summaries
- [ ] Author quests through Phase 10's Path/Quest CRUD, not a seed script
- [ ] Recalibrate existing difficulty/style labels against real
      `duration_ms`/pass-fail data once volume justifies it

---

## Phase 12 — Platform Hardening & Missing-Feature Pass *(was Phase 10)*

*Last gate before beta invite — nothing here optional.*

- [ ] Quest search/filter by tag, difficulty, Path
- [ ] Per-user submission history page (distinct from the activity feed)
- [ ] Public profile pages (badges/points/solved quests)
- [ ] Discussion/hints per quest (Discord-linked acceptable for v1)
- [ ] Rate limiting on auth + webhook endpoints
- [ ] RBAC role enum finalized, audit log wired to every admin action
      that exists by this point
- [ ] Full error/empty-state audit across every surface
- [ ] Full Playwright pass, 375/768/1280px, both themes, every surface
- [ ] README + MASTER_PLAN reconciled against actual shipped state before
      beta invite goes out

---

## Phase 13 — AI Qualitative Review *(was Phase 11)*

*Deliberately last — separate slice on top of the deterministic grading
engine, kept out of every phase before it.*

- [ ] Design scope: what triggers a qualitative review (e.g.
      `needs_review` status), what it evaluates beyond pass/fail
- [ ] Implementation (model, prompt, cost/rate considerations)
- [ ] UI surface for the feedback
