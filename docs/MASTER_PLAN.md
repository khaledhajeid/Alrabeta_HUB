# Alrabeta Hub — Master Plan (Developer Hub Pivot)

Status: **decisions locked, execution underway.** Supersedes the informal
phase tracking in the root `README.md`'s "Not done yet" section. Phases 0–5
(infra, identity, ingestion, Discord, the sandbox grading engine) are done
and unaffected by any of this. See `docs/TODO.md` for the granular,
continuously-updated task checklist this plan expands into.

This is the central reference for the pivot from "C/C++ systems-quest
checker for the Circle" to "market-driven developer hub." Rule going
forward, per direction: **we do not start a new phase until the current one
is at its peak and follows industry best practice** — so every phase below
ends with an explicit exit checklist, not a vague "done when it feels done."

**Note on phase numbering**: §9 originally proposed DevOps Foundation
(Phase 6) and Visual Identity (Phase 7) as separate sequential phases.
Direction was to execute them together as one — merged below into Phase 6,
with every phase after it shifted down by one (old Phase 8 Quest Runner is
now Phase 7, and so on through old Phase 12 AI Review, now Phase 11).
Global numbering stays continuous with the existing Phase 0–5 history
already referenced in commits/PRs/README.

---

## 0. Critique of the pivot, first

Asked for a critique, so here it is before the plan — this matters more than
any individual feature below.

**The pivot is right, but it has a real failure mode: becoming a worse
LeetCode.** LeetCode and HackerRank have years of content depth, huge
communities, and problem banks in the tens of thousands. A 14-person private
platform cannot out-content them, and shouldn't try. If "Bash quest" means
"paste a script, diff stdout against expected output," that's a strictly
worse HackerRank with three problems instead of three thousand.

The thing this platform already has that neither of those does: **it
actually verifies the thing it claims to grade**, not just output-matching.
The Violet-tier badges exist because the judge runs real memory/thread
sanitizers, not because it diffs stdout. That has to be the throughline
through every new Path, or the differentiator gets diluted away exactly
when the platform needs it most (see §4, the quest-runner design — a Docker
quest should be graded by inspecting the built image, not by asking "did it
print the right thing").

Second flag: five workstreams (content, visual identity, engine,
gamification/admin, DevOps) were proposed as if parallel. They're not —
they have a real dependency order, which is what the phased plan in §9
encodes. Doing visual identity after the engine work would mean redesigning
UI that already shipped; doing DevOps hardening last means every other
phase ships without the safety rails the user explicitly asked for. The
plan below sequences them accordingly, not in the order they were listed.

Third, a scope note on §3: an "I/O validation engine" for Bash/Docker/git
quests is not a small add-on to `judge.ts` — it's a second grading
architecture. Sized accordingly in §4/§9, not folded into a single phase
with something else.

---

## 0.5. Scale & audience — confirmed, and it's architectural

Every "14-person" reference elsewhere in this document (admin panel scope,
security sizing, PR-review cadence) describes the **current beta rollout**,
not a permanent design ceiling. Confirmed:

- **Two different answers on two different timelines.** Onboarding stays
  invite/admin-provisioned for now — a small private circle (~14 people,
  mostly 42 Amman alumni). The ultimate audience is junior-to-mid
  developers validating backend skills more broadly (regionally or
  globally), and the data model, job-queue design, and content need to
  hold up there even while the actual rollout stays small.
- **What that changes concretely**: `quest_submissions`, `badges`, the
  BullMQ grading queue, and anything Phase 7's quest-runner introduces
  should be designed against hundreds-to-thousands of users, not
  hand-tuned for 14 (e.g. don't assume a fixed, small submission volume
  anywhere a query pattern or index choice would need to change at real
  scale).
- **What stays deferred, deliberately — not forgotten**: CAPTCHAs,
  automated email verification, heavy anti-cheat/plagiarism detection.
  Real work, genuinely postponable until the platform actually opens up.
  This is a scope decision, not an oversight — don't build it early just
  because "bulletproof" was the standing instruction for Phase 6; that
  instruction was about process (branch protection, CI, commit hygiene),
  not about pulling forward public-facing SaaS surface area on a
  guess-timeline.
- **Branding stays general-purpose.** No content, copy, or UI decision
  should assume the reader already knows this circle's private context —
  the product should read as premium and self-explanatory to a stranger,
  even though today's real users all know each other.

This directly shapes how Phase 7 (§9) gets architected — see the updated
Phase 7 entry.

---

## 1. Content strategy: Paths, grounded in real market data

Research question: what should the platform actually teach, for a MENA/Jordan-leaning
audience of junior-to-mid backend/systems-leaning engineers (this group's
actual profile — mostly 42 Amman alumni)? Findings below are sourced; see
the "sources" line under each claim.

**What the data says, concretely:**

- **Git/Bash/Linux fundamentals are higher-signal than they sound**, not a
  "boring warm-up" tier. Weak Linux fundamentals is cited as the #1 reason
  junior DevOps candidates get screened out. *(InterviewStack, DevOps
  Engineer Skills 2026)*
- **CI/CD appears in 67% of active DevOps postings** — the single
  highest-frequency skill found in that survey. *(InterviewStack)*
- **Docker** is named essential across general full-stack roundups, with a
  dedicated 2026 piece specifically flagging it as "the infrastructure
  skill missing from your resume" for JS-leaning devs. *(Gloroots; JS Guru
  Jobs)*
- **TypeScript is now GitHub's #1 language by contributor count** (overtook
  Python/JS Aug 2025, +66.6% YoY), and shows up explicitly in Jordan-market
  postings (Next.js/tRPC/TypeScript). *(GitHub Octoverse 2025; Qureos,
  Jordan Tech Jobs 2025)*
- **Cloud basics (AWS specifically)**: 54% of DevOps postings; Jordan-market
  note is that cloud certs are an explicit "accelerator" given how much of
  that market is remote work for Gulf/international employers. *(InterviewStack;
  Qureos)*
- **Python automation/scripting**: 58%/53% of DevOps postings respectively.
  *(InterviewStack)*

**Where the data argues against an assumption we might otherwise make:**
DevOps is a *bad* framing for junior-facing content — postings assume 2–4
years of prior infra experience, and entry-level DevOps roles are ~1.9% of
that market. Frame this content as "skills that make a backend dev
competitive," never "become a DevOps engineer." Also: **Kubernetes is
high-frequency (56% of postings) but not quest-shaped** — a real K8s
exercise needs a cluster and more than 90 minutes. It's a longer-form
stretch path, not a standard quest.

**Decided**: not "DevOps" (confirmed as the wrong frame per the research
above) — the launch umbrella is **Backend Engineering Foundations**, one
Path covering four tracks. Broader Paths (Backend & API/TypeScript,
Containers & Cloud, CI/CD & Automation) are real and stay on the roadmap,
but launch narrower and prove one Path well rather than spreading thin
across five on day one. The quest-runner architecture (§3) is what makes
this extensible without a restructure later — a new Path is a curation
grouping over existing `tags`, not a schema change.

**Backend Engineering Foundations** *(launch Path)*:

| Track | Contents | Format note |
|---|---|---|
| Git mastery | Rebase, conflict resolution, bisect, history rewriting | Standard 30–90 min quests — flagship track, not filler. The research says this is where juniors actually lose points. |
| Linux/Bash scripting | Shell scripting, text processing, Linux fundamentals | Standard quests. |
| Docker containerization | Build/fix/inspect a container via the `dockerfile-check` runner (§3) | Standard quests. |
| Advanced C/C++ (systems) | Memory safety, concurrency — the existing Systems content | Unchanged grading (valgrind/TSan) — this is the platform's real differentiator, folded into the launch Path rather than kept as a separately-branded track. |

**Future Paths** *(post-launch, roadmap, not in Phase 7's initial content)*:

| Path | Contents | Format note |
|---|---|---|
| Backend & API | TypeScript/Node, REST/API integration, library usage, testing | Standard quests. |
| Containers & Cloud | Light AWS CLI-scoped tasks (beyond the Docker track above) | Explicitly *not* "learn AWS," scoped tasks only. |
| CI/CD & Automation | Write/fix a pipeline config for a stated goal, Python scripting tasks | Standard quests. |
| Deep Infra *(stretch)* | Kubernetes, Terraform/IaC | Explicitly longer-form, not the 30–90 min quest UI — don't force it into a format it doesn't fit. |

Source-quality note carried over from the research: the CI/CD%, Linux
screen-out, Docker, and Python/Terraform stats are direct citations from
named reports — strong. The Jordan-specific framing leans on
career-guide-level sources (Qureos, Nucamp), not a raw postings survey — no
MENA-specific developer survey exists yet. Treat that slice as directionally
right, not statistically precise.

---

## 2. Visual identity & design system

**Decided.** The "coding platform defaults to terminal-hacker green-on-black"
trap flagged here didn't happen — the chosen direction (Vercel/Linear/Raycast:
premium, minimalist, dark-default) is a real, deliberate register, not the
reflex this project has otherwise avoided elsewhere (gradient text,
side-stripes, eyebrow-scaffolding).

- **Vibe**: Vercel / Linear / Raycast — premium, minimalist, sleek.
- **Theme**: strict dark-mode default (deep charcoal/near-black canvas).
  Not just OS-preference-following — dark is the actual default regardless
  of the visitor's system setting; light stays available as an explicit
  opt-in via the existing theme toggle.
- **Accent**: Violet/Deep Purple as the primary brand color — confirms and
  extends the hook already flagged above. "Violet-tier" already existed as
  the achievement color (`--rare` in `globals.css`); it's now promoted to
  the platform's whole identity (`--accent`), not just a badge-reserved
  signal. Kept distinct from it: the existing green "live/success" status
  color (service-up dots, the activity feed's live indicator) stays green —
  that's state, not brand, and conflating the two would make an accepted
  submission and "this is the brand" mean the same visual thing when they
  don't.
- **Type**: JetBrains Mono for code (already wired up as `--font-mono` —
  no change needed there), Geist for UI text (replacing the current IBM
  Plex Sans `--font-sans`) — Geist specifically over Inter, since it's
  literally Vercel's own typeface and the closest match to the named
  reference.
- **Bilingual scope**: none for now — English-only, no RTL work.
- **Logo**: provided (full text+icon lockup, and an icon-only mark) —
  implemented as themeable React SVG components (`currentColor` fill, so
  they track light/dark automatically) for in-app use, plus a fixed-color
  icon-only SVG for the favicon (browser chrome isn't in the page's theme
  context, so favicons need a committed color rather than one that adapts).

Deliverable: `DESIGN.md` + the token system below, applied across every
existing surface (home, quests, repos, profile) — Phase 6 in §9.

---

## 3. Core engine expansion: the quest runner

Today, `judge.ts`/`judge.sh` is one grading strategy, hardcoded to C/C++ +
sanitizers. Every new Path in §1 needs code/config graded, and the grading
question is different per Path — this needs a real abstraction, not a
bigger if/else in `judge.ts`.

Proposed **quest runner** model: a quest declares a `runner` type + a
`spec`; `judge.ts` dispatches to the matching grading strategy. All
strategies keep the hardened sandbox model already validated in Phase 5
(`--network none`, resource caps, non-root, seccomp, read-only root +
`exec` tmpfs) — untrusted input is untrusted input regardless of language.

| Runner type | Used by | What it actually checks |
|---|---|---|
| `sandbox-exec` *(exists)* | Advanced C/C++ track | Compile + run C/C++ under valgrind/ASan/UBSan/TSan |
| `io-match` | Linux/Bash track, future Backend & API Path | Run submitted code (Bash/Python/Node) against stdin→stdout test cases in the same hardened container |
| `dockerfile-check` | Docker containerization track | `docker build` the submission, then inspect the *resulting image* — non-root user, exposed ports, layer count, size — not just "did it build" |
| `git-assert` | Git mastery track | Clone the submitted branch, run assertions against `git log`/reflog structure (e.g. "no merge commits," "exactly 3 commits after rebase") |

This is real, sized work — a new grading architecture, not an extension of
the existing one. It's its own phase (Phase 7), not a task inside another
phase.

---

## 4. Gamification expansion

- **Two currencies, not one**: points (permanent, drives leaderboard rank —
  Codewars' model of a rank that never resets is worth copying for a
  permanent small group over a resettable/seasonal leaderboard) and a
  separate spendable currency for the shop. Keeps "grinding for rank" and
  "grinding for shop items" from being the same optimization.
- **Streaks**: consecutive days with an accepted submission. Needs a
  computed streak counter, updated by the grading worker — cheap to add
  given the worker already runs per-submission.
- **Shop, kept small at MVP**: cosmetic first (profile flair, a title,
  "featured on the activity feed" for a day). The Discord webhook
  integration already in place is a natural extension point — a point
  threshold could trigger a bot-assigned Discord role. Leave room for the
  admin to add a manual "real-world" reward line item later (this is a
  friend group; a "loser buys the next hangout's snacks" reward is more
  in-character than another digital badge, and costs nothing to support —
  just an admin-created shop entry with no code behind the redemption).
- **Post-solve peer visibility** (borrowed from Codewars/Exercism, and
  genuinely easier to do well at 14 people than at their scale): once a
  user passes a quest, show them everyone else's accepted solution for it.
  A small trusted circle can give real feedback on each other's code in a
  way a platform serving millions structurally can't — lean into that
  rather than trying to build automated code-quality scoring.

---

## 5. Admin panel

Scoped to what an admin on a 14-person platform actually does day to day,
not a generic enterprise admin suite:

- **Users**: list + role toggle (admin/member). No bulk CSV import, no
  permission matrix — a simple table is the right size here.
- **Quests**: real CRUD UI over the existing `quests` table/`status` enum
  (currently only editable via `scripts/seed-quests.ts` — that's a real
  gap once quest volume grows past what a seed script should own).
- **Submissions/grading monitor**: a view over `quest_submissions` +
  BullMQ queue depth/failed jobs. Worth explicitly checking whether an
  existing OSS queue dashboard (e.g. Bull Board) covers this before
  building a custom one — self-hosting an existing tool is less work than
  writing a monitoring UI from scratch.
- **Audit log**: append-only table of admin actions (role changes, quest
  publish/unpublish). A simple table, not a SIEM.

---

## 6. Missing "no-brainer" features (competitive gap check)

Checked against LeetCode, HackerRank, Codewars, Exercism, and an enterprise
training platform (Pluralsight) for what's genuinely table-stakes vs.
over-engineering at this scale.

**Table stakes, currently missing:**
- Quest search/filter by tag, difficulty, and Path
- Per-user submission history page (distinct from the activity feed)
- Public profile pages showing badges/points/solved quests (currently
  `/profile` is private-session-only)
- Discussion/hints per quest — doesn't need to be a built comment system;
  could be as light as a linked Discord thread per quest, given Discord's
  already the group's real communication layer

**Genuine differentiators worth adding** (already covered above): the
post-solve peer-visibility feature, and the sandbox's actual verification
(already the platform's edge — the point is to extend it via the quest
runner, not dilute it).

**Explicitly skip at 14-user scale** (these exist on the big platforms
because of scale/adversarial users, neither of which applies here):
plagiarism/anti-cheat detection, multi-region/load-balanced infra,
enterprise SSO/SCIM, tiered subscription billing.

---

## 7. Security, scaled to reality

Real no-brainers, sized for a private 14-person tool rather than enterprise
SaaS paranoia:

- Rate limiting on the auth and webhook endpoints — mainly protects against
  an accidental retry storm, not a realistic attacker
- Audit log on admin actions (§5) — cheap, and the first thing you'd want
  if something ever looks wrong
- RBAC as a single `role` enum on `user` (admin/member) — a full
  permissions matrix is solving a problem this platform doesn't have
- Keep doing what's already established: no secrets in chat, `.env.local`
  for credentials, HMAC-verified webhooks (already in place)

**Explicitly skip**: WAF, a dedicated secrets manager (env vars +
`.gitignore` is the right size here), anything SOC2-shaped.

---

## 8. DevOps / SDLC

The ask was "main/staging/dev branches" — the actual industry best practice
for a team this size is different from that, and worth pushing back on
directly rather than building what was assumed: **trunk-based development**
(a single `main`, always deployable, short-lived feature branches,
squash-merged) is the model correlated with high-performing teams in the
DORA/Accelerate research, precisely because long-lived `dev`/`staging`
branches accumulate merge drift that a small team pays for disproportionately.
This project is already doing trunk-based in practice (feature branch → PR
→ squash-merge → delete) — the gap isn't the branching model, it's that
nothing *enforces* it yet, and there's no automated deploy at all.

**What "staging" should actually mean here**: not a git branch, an
*environment*. Same trunk, promoted to two deploy targets. Concretely:
merge to `main` auto-deploys to a staging host (or a second local process
behind `staging.alrabetahub.app` via the existing Cloudflare Tunnel);
promotion to production is a manual gate, not a second long-lived branch to
keep in sync.

**Concrete plan, in order:**

1. **Branch protection on `main`**: require PR review, require CI green,
   disallow direct pushes and force-push. (Direct pushes to `main` have
   happened during this project, out of necessity before this was
   formalized — this closes that.)
2. **CI via GitHub Actions cloud runners** — confirmed. Lowest-friction,
   zero-maintenance at this scale; Forgejo Actions stays noted as a future
   consolidation option, not the near-term move. `.github/workflows/ci.yml`
   runs typecheck, lint, and build on every push to `main` and every PR —
   real Postgres/Redis service containers included, since server modules
   connect to both at module scope even though nothing queries at build
   time.
3. **Commit convention enforcement**: this project already writes
   Conventional Commits by discipline — formalize it with commitlint +
   a commit-msg hook so it's structural, not just habit.
4. **Issue tracking**: GitHub Issues + a Projects board, no new tool.
   Labels for Path/phase/priority/type; milestones map to the phases in §9.
5. **Real CD — deferred, not declined**: no VPS exists yet, so "deploy"
   today is still a manual `npm run build && npm run start` on the dev
   machine per the README. A self-hosted runner for auto-deploy-on-merge
   was considered and explicitly passed on for now in favor of staying
   zero-maintenance on cloud runners — branch protection + CI delivers most
   of the actual safety on its own, and automated deploy is worth
   revisiting once there's real hosting infra rather than a personal
   machine.
6. **PR/issue templates + a lightweight CODEOWNERS** — cheap, and the kind
   of thing that's much easier to add before a rush of PRs from 14 people
   than after.

---

## 9. Phased roadmap

Continuing the numbering from the existing Phases 0–5. Each phase has an
explicit exit checklist — the "peak potential" bar — before the next one
starts. Granular task-level breakdown lives in `docs/TODO.md`; this stays
the phase-level view.

### Phase 6 — DevOps Foundation & Visual Identity
*Merged per direction — executed as one phase rather than two. Why first:
every later phase ships more safely once the DevOps half exists, and every
UI surface built after this point should be built once against a real
design system rather than restyled later.*
- [x] `.github/workflows/ci.yml`: typecheck, lint, build on push to `main`
      and every PR, with real Postgres/Redis service containers
- [ ] Branch protection on `main` (PR + green CI required, no direct push)
      — enabled once the workflow above has run green at least once
- [ ] Commitlint + commit-msg hook enforcing Conventional Commits
- [ ] Issue templates, PR template, labels, milestones per phase
- [x] Visual identity decisions locked (§2): Vercel/Linear/Raycast register,
      strict dark default, Violet/Charcoal palette, Geist + JetBrains Mono,
      logo assets received
- [ ] `DESIGN.md` + token system (OKLCH, Violet-tier-anchored palette,
      typography pairing, layout rules)
- [ ] Existing surfaces (home, quests, repos, profile) re-skinned to the
      new system — no new pages, just the system proven against what
      already exists before it's used to build anything new
- [ ] Logo integrated: React components (themeable, `currentColor`) in
      navbar/auth screens, fixed-color favicon

### Phase 7 — Quest Runner & Content Buildout
*Why next: this is the actual product expansion — new grading architecture
(§3) plus real content in the launch Path (§1), which needs a design
system to land in and a safe pipeline to ship through (Phase 6).*
- [ ] Quest runner abstraction: `io-match`, `dockerfile-check`, `git-assert`
      runner types, all under the same hardened sandbox model as Phase 5
- [ ] Backend Engineering Foundations content: real quests across all four
      tracks (Git, Bash/Linux, Docker, advanced C/C++) — enough to
      actually test the runner types against real content, not stubs
- [ ] Paths as a real browsing structure on `/quests`, not just a tag

### Phase 8 — Gamification Expansion
- [ ] Two-currency system (points/rank, spendable shop currency)
- [ ] Streaks, computed off submission history
- [ ] Shop v1 (cosmetic items + Discord role integration)
- [ ] Post-solve peer solution visibility

### Phase 9 — Admin Panel
- [ ] User list + role management
- [ ] Quest CRUD (retiring `scripts/seed-quests.ts` as the only path to
      publishing a quest)
- [ ] Submissions/grading monitor
- [ ] Audit log

### Phase 10 — Platform Hardening & Missing-Feature Pass
*Last gate before beta invite.*
- [ ] Quest search/filter, submission history page, public profiles
- [ ] Discussion/hints per quest (Discord-linked is an acceptable v1)
- [ ] Rate limiting on auth/webhook, RBAC role enum, audit log wired to
      the admin actions that exist by this point
- [ ] Error/empty states audited across every surface (Playwright,
      375/768/1280px, per this project's existing UI QA standard)

### Phase 11 — AI Qualitative Review *(unchanged, still deliberately last)*
Kept exactly where it already was — a separate, later slice on top of the
deterministic grading engine, not folded into any of the above.

**Beta invite happens after Phase 10's checklist is genuinely clear**, not
before — matches the explicit "hold the brakes" direction.

---

## 10. Decisions log

Formerly "open questions" — resolved:

1. **Visual identity** (§2): Vercel/Linear/Raycast register, strict dark
   default, Violet/Charcoal + Geist/JetBrains Mono, no bilingual scope,
   logo assets provided.
2. **Path framing** (§1): confirmed — "Backend Engineering Foundations" as
   the launch Path (Git, Bash/Linux, Docker, advanced C/C++), broader Paths
   and Deep Infra stay on the future roadmap, not pulled forward.
3. **CI/CD runner**: GitHub Actions cloud runners, confirmed — zero
   maintenance at this scale. Self-hosted runner for auto-deploy explicitly
   deferred (§8, item 5), not declined outright.
