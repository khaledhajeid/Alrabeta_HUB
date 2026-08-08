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
- [ ] Enable branch protection on `main` (require the CI check, require
      PR review, disallow direct push/force-push)
- [ ] Commitlint + commit-msg git hook enforcing Conventional Commits
- [ ] GitHub issue templates (bug/feature), PR template
- [ ] Labels: Path (`git`, `bash`, `docker`, `systems`, ...), phase, type
      (bug/feature/chore), priority
- [ ] GitHub Projects board, milestones mapped to Phases 6–11
- [ ] Lightweight `CODEOWNERS`

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

- [ ] Design the runner-type abstraction: `quests` table gains a `runner`
      type + `spec` field (or equivalent); `judge.ts` dispatches instead
      of assuming C/C++ unconditionally
- [ ] Extract the existing C/C++ sanitizer flow into the `sandbox-exec`
      runner without changing its behavior (refactor, not rewrite —
      Phase 5's hardened flag set and Violet-tier logic must survive
      unchanged)
- [ ] Implement `io-match` runner (stdin→stdout test cases, hardened
      container, for Bash/scripting quests)
- [ ] Implement `dockerfile-check` runner (`docker build` + image
      inspection: non-root user, exposed ports, layer count/size)
- [ ] Implement `git-assert` runner (clone submitted branch, assert
      against `git log`/reflog structure)
- [ ] Re-verify each new runner against known-good/known-bad fixtures
      before it grades anything real — same discipline as Phase 5's
      fixture re-verification after every hardening change
- [ ] Author real content for Backend Engineering Foundations: Git
      mastery, Linux/Bash scripting, Docker containerization, advanced
      C/C++ tracks — enough quests per track to exercise each runner
      against real content, not stubs
- [ ] Paths as a real browsing/filtering structure on `/quests`, not just
      a tag pill

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
