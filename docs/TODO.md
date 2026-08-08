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
      phase (`phase-6`…`phase-11`), type (`chore` added; `bug`/
      `enhancement` already existed as GitHub defaults, reused rather than
      duplicated), priority (`priority: high/medium/low`) — 21 total,
      verified via `gh label list`
- [ ] GitHub Projects board, milestones mapped to Phases 6–11
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
- [ ] Implement `dockerfile-check` runner — deliberately not in this slice,
      needs its own Phase-0-style hardening pass (Docker-in-Docker is a
      materially harder security problem than the other three runners, see
      docs/MASTER_PLAN.md §9's Phase 7 entry)
- [ ] Implement `git-assert` runner — needs a real `git clone`/`fetch`
      fetch path (history-aware assertions can't work off a tarball
      snapshot), not built this slice either
- [ ] Author more Foundations content beyond the one io-match quest —
      enough per track to be a real launch surface, not a single proof point
- [ ] Paths as a real browsing/filtering structure on `/quests`, not just
      a tag pill

**Paused here.** Per the standing rule (no new phase until the current one
peaks), the remaining four items above wait until Phase 7.5 is done — the
product owner flagged the shipped Phase 6 re-skin as "gloomy, flat,
lifeless" and asked for a full UI/UX pass before any more runner or content
work. Resume this list once Phase 7.5's exit checklist is clear.

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
- [ ] Hover/focus micro-interactions beyond color: subtle transform/shadow
      response on interactive rows, buttons, tag pills
- [ ] Route/page transitions (View Transitions API or an equivalently thin
      approach — no heavy client-side animation runtime unless a concrete
      need shows up that CSS can't cover)
- [ ] List entrances (activity feed, quest catalog, commit history) stagger
      in on mount — one deliberate reveal per list, not a uniform reflex
      applied everywhere
- [ ] Submission-result state gets a real entrance (see 7.5.F — this is
      where motion and the gamification-visibility fix meet)

### 7.5.D — Depth applied
- [ ] Replace bare `border` on cards/nav/homepage surfaces with the 7.5.A
      elevation scale where it's actually a raised surface; keep borders
      for genuinely tabular/dense content (commit list, markdown tables) —
      not everything gets a shadow, that's a different flatness problem

### 7.5.E — Information hierarchy & content differentiation
- [ ] Real type scale beyond "h1 vs. everything else" — quest titles, point
      values, tags, timestamps currently all sit in the same 12–14px band
- [ ] Break the one-row-template-for-everything pattern: quest catalog
      becomes browsable cards (not a bordered row list), activity feed gets
      timeline treatment, repo directory differentiated from the commit
      list (which stays dense/tabular — that one's correct as a list)

### 7.5.F — Gamification made visible (UI only — no new schema/currency)
- [ ] Submission result (`Passed`/`Failed`/`Needs review`) redesigned with
      real visual weight: color + icon + the 7.5.C entrance motion, not a
      14px text row indistinguishable from a timestamp
- [ ] A minimal badge/tier display surfaced on profile + quest detail —
      `--accent`'s own origin story (the Violet-tier badge signal) is
      currently invisible in the shipped product. Two-currency/streaks/shop
      stay exactly where they are, in Phase 8 — this is "show the badges
      that already exist," not "build the economy"
- [ ] Tone lock: quiet and confident, not game-arcade — a clean color/icon
      state change plus one deliberate motion beat, matching the
      Vercel/Linear/Raycast restraint this project has already committed
      to, not a confetti burst. The "reward" comes from precision and
      real weight, not decoration volume

### 7.5.G — Accessibility & robustness (fixes the audit found directly)
- [ ] `--ember` light-mode contrast bug: 3.39:1 on rendered quest code
      blocks (needs 4.5:1) — either fix the color or correct DESIGN.md's
      "reserved, not yet used" claim to match what's actually live
      (`globals.css:229-233`)
- [ ] Service-status dots get a text/aria-live alternative — currently
      color-only and `aria-hidden`, a real WCAG 1.4.1 failure
- [ ] Mobile menu gets a focus trap and an Escape handler — currently
      neither exists
- [ ] Tag-filter pill wall (10 unranked pills for a 4-quest catalog)
      collapses to a search/combobox past ~5–6 tags
- [ ] `loading.tsx` and `error.tsx` added under `app/` — currently absent
      everywhere, meaning a blank flash on slow loads and Next's generic
      unstyled crash screen on errors
- [ ] Avatar `<img>` → `next/image` (`profile/page.tsx`, `auth-button.tsx`),
      real `alt` text instead of `alt=""` on a meaningful image

### 7.5.H — Verification
- [ ] Full Playwright pass, 375/768/1280px, both themes, every touched
      surface — this project's existing standard, not a new one
- [ ] Contrast re-verified computationally (not eyeballed), same method as
      Phase 6
- [ ] Performance budget check: Lighthouse/Core Web Vitals before vs. after
      — motion and elevation must not cost real frame time or bundle size;
      CSS-first per 7.5.C, no animation library added unless a concrete gap
      shows up that CSS genuinely can't cover
- [ ] Re-run `/impeccable critique` on the same surfaces — confirm the
      score actually moved off 16/40, not just "it looks different now"
- [ ] `docs/DESIGN.md` updated to reflect the v2 token system (elevation,
      motion, z-index, type scale) and logo lockup change

---

## Phase 8 — Gamification Expansion

- [ ] Design the two-currency model (permanent points/rank vs. spendable
      shop currency) and the schema it needs
- [ ] Streak tracking, computed off submission history
- [ ] Shop v1: cosmetic items (profile flair, title, activity-feed
      feature), admin-addable manual/"real-world" reward line items
- [ ] Discord role integration at point thresholds (extends the existing
      webhook integration)
- [ ] Post-solve peer solution visibility (once passed, see others'
      accepted solutions for that quest)

---

## Phase 9 — Admin Panel

- [ ] `role` field on `user` (admin/member), auth guard for admin routes
- [ ] User list + role management UI
- [ ] Quest CRUD UI (retires `scripts/seed-quests.ts` as the only way to
      publish a quest)
- [ ] Submissions/grading monitor — check whether an existing OSS queue
      dashboard (e.g. Bull Board) covers this before building custom
- [ ] Audit log (append-only table + admin actions wired to log to it)

---

## Phase 10 — Platform Hardening & Missing-Feature Pass

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

## Phase 11 — AI Qualitative Review

*Deliberately last — separate slice on top of the deterministic grading
engine, kept out of every phase before it.*

- [ ] Design scope: what triggers a qualitative review (e.g.
      `needs_review` status), what it evaluates beyond pass/fail
- [ ] Implementation (model, prompt, cost/rate considerations)
- [ ] UI surface for the feedback
