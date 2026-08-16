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

**Second renumbering (2026-08-09)**: two new phases inserted once the
Educational/Pure + Mastery Path/Standalone content methodology (§1.5) and
the Market-Driven Content mandate were formally adopted — see decision 10.
A dedicated Learning UI/UX phase (new Phase 8) and a Market-Driven Content
phase (new Phase 11) pushed every phase from the old Phase 8 onward down
by two. Old Phase 8 Gamification is now Phase 9, old Phase 9 Admin is now
Phase 10, old Phase 10 Hardening is now Phase 12, old Phase 11 AI
Qualitative Review is now Phase 13. Same rule as the first renumbering:
global numbering stays continuous, nothing about the work itself changed,
only where it sits in sequence.

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

## 1.5. Learning methodology: style and structure

Decided 2026-08-09, grounded in cognitive-load and instructional-design
research (cited below), not platform-copying. Two independent axes, not a
single four-way taxonomy — a quest's `style` and its `structure` are
orthogonal, so an easy Pure quest and a hard Educational quest both make
sense, and neither implies the other.

**Axis 1, style, how much is explained upfront:**
- **Educational**: a short primer, a few sentences, at most one small
  worked-example snippet, never a full article, immediately followed by
  the challenge. Kept deliberately brief: the testing/generation effect
  research shows retrieval produces roughly 80% recall after a week versus
  36% for passive re-study, so the challenge itself, not the explanation,
  is where retention actually comes from. A long primer works against the
  platform's own mechanism, not for it.
- **Pure**: the full, unambiguous problem statement (never an ambiguous
  one, "pure" means no taught concept, not a vague prompt, the same
  standard Advent of Code holds itself to) plus a short list of keywords
  or concepts to research externally. No tutorial, no doc links, no
  step-by-step. Modeled on Exercism's philosophy of skipping upfront
  teaching in favor of feedback after an attempt, adapted for a solo/async
  context: this platform doesn't have live mentors, so the automated
  runner verdict (a real pass/fail plus specifics, not a vague grade) is
  what substitutes for a mentor's feedback loop.

**Axis 2, structure, where a quest lives:**
- **Mastery Path**: an ordered, curated sequence in one domain, beginner
  to expert. Style fades across the sequence: early quests in a path skew
  Educational, later quests in the same path skew Pure, directly mirroring
  the faded-worked-examples research (gradually stripping scaffolding
  across a sequence measurably outperforms both static worked examples and
  pure problem-solving from the start). Difficulty climbs the same way.
- **Standalone**: bite-sized, no prerequisites, sized for a single
  session with a bit of targeted research. Not gated to a path. A future
  daily-rotation/streak mechanic could hang off this bucket, but that's
  explicitly Phase 9 (Gamification) scope, not a data-model requirement
  now — see decision 10.

**Two calibration principles from the research, not just preference:**
- **Don't hard-gate paths yet.** Bjork's "desirable difficulties"
  framework is explicit that a difficulty only builds skill if the learner
  is actually capable of executing it and gets close, specific, timely
  feedback, otherwise it's just frustration, the same claim Vygotsky's
  zone of proximal development makes: a task has to sit between "can
  already do alone" and "can't do even with help." A hard prerequisite-gate
  wall is real engineering cost this platform's current content volume
  doesn't justify yet. Recommended ordering plus a visual "next up" cue
  gets the calibration benefit without the graph.
- **Treat difficulty and style labels as estimates, not facts.** Codewars
  ties its kata difficulty to a rank system explicitly designed so "the
  next challenge stretches but never crushes," while documenting outright
  that the ranking itself is imperfect and community-corrected over time.
  This platform doesn't have community volume yet, but every submission
  already logs `duration_ms` and pass/fail in `judgeOutput` — real
  completion data sitting unused. Recalibrate labels against it once
  there's enough volume to mean something, the same "verify empirically"
  discipline already applied to every runner in this project.

**Sources**: [Effects of Worked Examples with Explanation Types and
Learner Motivation (ACM TOCE)](https://dl.acm.org/doi/full/10.1145/3732791) ·
[The Mentoring Mindset, Exercism Docs](https://exercism.org/docs/mentoring/mindset) ·
[About, Advent of Code](https://adventofcode.com/about) ·
[Desirable Difficulties: Bjork's 5 Principles](https://www.structural-learning.com/post/desirable-difficulties) ·
[A Guide to Vygotsky's Zone of Proximal Development and Scaffolding](https://elearningindustry.com/guide-to-vygotskys-zone-of-proximal-development-and-scaffolding) ·
[Ranks, The Codewars Docs](https://docs.codewars.com/gamification/ranks/) ·
[Retrieval mode distinguishes the testing effect from the generation effect](https://www.sciencedirect.com/science/article/abs/pii/S0749596X09001156)

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

## 2.5. UI/UX Redesign, A-to-Z (Phase 7.5)

Phase 6 shipped a correct re-skin — tokens, dark-mode-first execution, and
logo/type swap all landed cleanly. It did **not** ship a layout or motion
rework, and the product owner's own assessment after using it for real is
that it reads "gloomy, flat, lifeless" and lacks the "distinct visual
identity that makes a modern developer tool feel truly premium." That's a
real gap, not a false complaint — confirmed below, not just asserted.

### The audit (2026-08-08)

Ran a full `/impeccable critique` dual-agent audit (design review +
detector/browser evidence, isolated from each other) against home, nav,
quests, quest detail, and repos, both themes. Full report:
`.impeccable/critique/2026-08-08T15-06-42Z__apps-web-home-nav-quests-quest-detail.md`.

**Score: 16/40 (Poor band).** Not a subjective read — grounded in things
that are true regardless of taste:
- **One `transition-colors` rule exists in the entire codebase.** No
  `@keyframes`, no animation library, no page transitions, no reveal, no
  stagger. There's no motion system to tune because there's no motion.
- **One `shadow-lg` exists in the entire app** (a dropdown panel). Every
  card, nav bar, and code block uses `border` for separation; no elevation
  scale, no semantic z-index scale beyond a single hardcoded `z-20`.
- **Nav is `h-14` (56px)** — 12–30% shorter than the stated reference set
  (Linear/Vercel run 64px+) for zero density gain. The desktop `Logo`
  lockup renders at ~42.5×24px, meaning the wordmark inside it is
  functionally illegible (~6-8px cap-height); mobile drops the wordmark
  entirely.
- **The gamification layer is invisible.** `DESIGN.md` documents that
  `--accent` "grew out of the Violet-tier badge signal," but across every
  inspected surface, zero badges/tiers/streaks render anywhere. A quest
  submission result (`Passed`/`Failed`) is a plain 14px text row — visually
  identical in weight to a nav link. For a "gamified" product, the single
  highest-stakes moment in the whole loop currently has no payoff at all.
- Real bug found in passing: `--ember` (documented in `DESIGN.md` as
  "reserved, not yet used") is actually live as a syntax-highlight color
  and fails WCAG AA in light mode (3.39:1, needs 4.5:1) — a
  documentation/implementation drift the detector's source scan couldn't
  catch (needs rendered computed-style math), but the browser-evidence pass
  did.

What's *not* wrong: the token system itself is well-reasoned (`--accent`
deliberately kept distinct from `--signal`), dark-mode execution is
technically clean (real computed contrast, no FOUC), copy voice has real
personality, and the deterministic AI-slop scan came back clean (no
gradient text, no side-stripes, no eyebrows — Phase 6's own discipline
held). This is a motion/depth/hierarchy/gamification-visibility gap, not a
broken-engineering one.

### Benchmark research

Pulled concrete, sourced specifics from the three named references plus
Supabase (same dark-first developer-tool category, useful contrast point)
rather than working from vibes:

- **Vercel (Geist system)**: "shadow-as-border" — `box-shadow: 0 0 0 1px
  rgba(0,0,0,.08)` replacing traditional CSS borders, layered into
  multi-value stacks (border layer + soft elevation layer + ambient depth
  layer + an inner highlight ring) so cards read as "built," not
  "floating." Motion tokens: 150ms/200ms, `cubic-bezier(0.2,0,0,1)`. 8px
  spacing base with a deliberate jump from 16px to 32px (no 20/24px in the
  primary scale) — whitespace itself carries meaning ("nothing to prove,
  nothing to hide").
- **Supabase**: dark-first, near-black (`#000`–`#0f0f0f` range) with
  exactly one accent carrying all brand weight — restraint as the whole
  strategy, not an omission. Elevation via `backdrop-filter: blur(4px)`
  plus a 3px focus outline at 0px offset. Directly useful as a same-
  category (dark developer-tool dashboard) reference point since Vercel's
  own marketing site is light-mode-first, unlike this product.
- **Raycast**: three stated principles — fast, simple, delightful. Their
  own 2022 redesign is a direct playbook match for this phase: bigger
  search/icons for the thing that matters most, consolidated a scattered
  action-bar/toast/nav-title pattern into one coherent bottom bar,
  "Compact Mode" for a more focused view. The throughline: every visual
  change traced back to a stated principle, not decoration for its own
  sake — the same discipline this phase needs to apply to Alrabeta's
  motion and depth additions.

### Scope discipline

This phase changes **how the existing product looks and moves**, not what
it does. Two-currency points/shop economy, streaks, and peer-solution
visibility stay exactly where they already are — Phase 9 (Gamification).
The only gamification work pulled into this phase is making the badge/tier system
that already exists conceptually (and already named the brand accent)
actually render somewhere — a visibility fix, not new mechanics.

Full lettered execution breakdown (7.5.A through 7.5.H — foundations,
identity, motion, depth, hierarchy, gamification visibility, accessibility
fixes, verification) lives in `docs/TODO.md`.

### Closing the phase: the re-audit (2026-08-08)

Ran the same dual-agent `/impeccable critique` process used to open this
phase, against the same surfaces, as the actual exit gate — not a status
update, a genuine independent re-check. Full report:
`.impeccable/critique/2026-08-08T18-28-15Z__apps-web-home-nav-quests-quest-detail.md`.

**Score: 16/40 → 26/40 (Poor → Acceptable).** Both agents independently
verified every one of the four originally-named findings fixed *live* —
real measurements (contrast ratios, bounding rects, keyboard event
traces, grep counts), not the changelog taken on faith:
- Motion is real, consistent, and respects reduced motion — including the
  `::view-transition-*` pseudo-element gap most implementations miss.
- Elevation is on 9 real surfaces now, was 1 (`shadow-lg` on a dropdown).
- The nav/logo are legible at every breakpoint and the logo link hits a
  real 44px touch target (was 28×28).
- The badge/gamification system renders with real data on two surfaces,
  plus a pre-solve hint that didn't exist before.

The re-audit also did its actual job — it found things the shipped work
missed:
- **`--signal` failed WCAG AA in light mode** (3.59–3.77:1), the identical
  failure class as the `--ember` bug 7.5.G had just fixed, and it hit the
  brand-new `SubmissionStatus` "Passed" text directly. Fixed immediately
  (emerald-600 → emerald-700, 5.23–5.48:1), verified live.
- The activity feed's "live" indicator dot repeated the exact
  color-only/`aria-hidden`-with-no-alternative pattern 7.5.G fixed for the
  service-status dots — missed on this one. Fixed immediately, same
  pattern.
- `BadgePill`'s description lived only in a `title` attribute — unreliable
  for screen readers, unavailable on touch. Fixed with a real `sr-only`
  alternative.

**Deliberately not fixed, logged instead of scope-creeping:** the
submission-status row doesn't self-update — no SSE/polling on the
quest-detail submissions list, unlike the activity feed. This is real
product work (extending real-time infrastructure to a second surface), not
UI/motion/accessibility polish, and doesn't belong in a phase whose job was
the latter. Revisit alongside Phase 9 (Gamification) or whenever
submission UX gets its own slice. Two more items — sparse-data grids at low item counts, and
difficulty labels with no visual coding — are P3/opinion-level, noted for
a future pass, not blocking.

**Performance held.** Lighthouse against a production build: 95/100
performance, 100/100 accessibility, 0 CLS on home/quests/quest-detail —
the CSS-first motion approach cost nothing measurable.

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
| `io-match` *(exists)* | Linux/Bash track, future Backend & API Path | Run submitted code (Bash/Python/Node) against stdin→stdout test cases in the same hardened container |
| `dockerfile-check` *(exists)* | Docker containerization track | Build the submission's Dockerfile with Kaniko (no Docker-in-Docker, no daemon), through an egress-allowlisted network, then inspect the resulting image: non-root user, base image tag, size, plus a hadolint static lint pass. Not just "did it build" |
| `git-assert` *(exists)* | Git mastery track | Full clone of the submission's repo (all branches, full history), run assertions against `git log`/`rev-list` structure (no merge commits, commit count, message conventions). Reflog turned out not to be viable — it's local-only, never transferred by a clone — so assertions are scoped to what commit ancestry can actually verify |

This is real, sized work — a new grading architecture, not an extension of
the existing one. It's its own phase (Phase 7), not a task inside another
phase.

---

## 3.5. Paths data model

Decided 2026-08-09, per explicit direction: build this as a real
normalized relational structure now, not a lightweight `pathSlug` column
shortcut, even though it won't be populated with more than a handful of
paths at first. The reasoning holds regardless of current content volume:
path membership is a relationship with its own attribute (position in the
sequence), which is exactly the case a join table exists for, not a
premature abstraction. Not implemented yet, this section documents the
design; the migration itself is Phase 7's next concrete slice (§9).

```
paths                          path_quests                    quests
----------------------------   -----------------------------  --------------------
id            uuid PK          id           uuid PK            id            uuid PK
slug          text UNIQUE      path_id      uuid FK -> paths   ...(existing columns)
title         text             quest_id     uuid FK -> quests  style  "educational"|"pure"
summary       text             order_index  int
status        draft|published  created_at   timestamptz
author_id     text FK -> user
created_at    timestamptz
updated_at    timestamptz
```

- **`paths` is a first-class entity**, not a tag or an enum on `quests` —
  it needs its own `slug`/`title`/`summary`/`status` for the same reason
  `quests` does: an admin needs to author, draft, and publish a path
  independent of any single quest inside it (Phase 10's Admin Panel gains
  Path CRUD alongside Quest CRUD accordingly, see §9).
- **`path_quests` is a proper join table with an `order_index` column**,
  not an array of quest IDs on `paths` or a `pathId` column directly on
  `quests`. A quest belonging to exactly one path is the common case today,
  but nothing about the schema assumes that, a foundational quest reused
  as the intro to two different paths is a real normalized many-to-many
  relationship, not a hack, and costs nothing extra to support now versus
  retrofitting later. `unique(path_id, quest_id)` stops a quest being
  double-added to the same path; `unique(path_id, order_index)` stops two
  quests claiming the same slot; the composite index on
  `(path_id, order_index)` is what makes "fetch this path's quests in
  order" a single indexed scan, not a sort at query time.
- **Standalone is the absence of a `path_quests` row**, not a boolean flag
  on `quests`. Storing "is this standalone" as its own column would be
  redundant, derivable state, exactly the kind of denormalization that
  drifts out of sync with reality over time.
- **`quests.style` is a new enum column** (`"educational" | "pure"`),
  independent of `path_quests` and independent of the existing
  `difficulty` enum, matching §1.5's orthogonal-axes decision. Existing
  quests default to a real value assigned during Phase 7's retrofit pass
  (see §9), not left to an implicit schema default that nobody actually
  chose.
- **Deliberately not built yet**: path-level prerequisites (path A gates
  path B). Worth a `path_prerequisites` join table in the same shape as
  `path_quests` if it's ever needed, but nothing in the current content
  volume or the roadmap ahead justifies it now, matching §1.5's
  don't-hard-gate-yet calibration principle applied one level up.

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

### Phase 7 — Quest Runner & Content Buildout ✅ done
*Why next: this is the actual product expansion — new grading architecture
(§3) plus real content in the launch Path (§1), which needs a design
system to land in and a safe pipeline to ship through (Phase 6). Closed
2026-08-09 — see `docs/TODO.md` for the granular breakdown.*
- [x] Quest runner abstraction: `judge.ts` orchestrates, all four runners
      (`sandbox-exec`, `io-match`, `git-assert`, `dockerfile-check`) now
      implemented as separate hardened runner modules, each with its own
      BullMQ queue/concurrency. `dockerfile-check` rejected
      Docker-in-Docker outright in favor of Kaniko plus an
      egress-allowlisted network, see the risk table above and decision 8
- [x] `io-match` real-E2E-verified (a genuine Foundations quest, both a
      failed and a passing real submission graded correctly through the
      full pipeline)
- [x] `git-assert` implemented and real-E2E-verified against the actual
      Forgejo instance (not just fixtures) — a genuinely different trust
      model from the other two runners, since it inspects git history
      rather than executing anything the submitter wrote. Found and fixed
      two real bugs before trusting it (a silent `git config --global`
      failure from the sandbox's homeless non-root user, and
      `rev-parse --verify` accepting the all-zero SHA as "verified" —
      see `infra/sandbox-git-assert/README.md`). Seeded a real quest
      (`three-clean-commits`, Git track)
- [x] Backend Engineering Foundations content: every Foundations track now
      has 3 quests, matching parity, not proof points
- [x] Paths relational data model (§3.5): `paths` + `path_quests` join
      table with a real `order_index`, plus a new `quests.style` enum
      (`educational`/`pure`). Built as a real normalized structure per
      explicit direction, not a lightweight shortcut, even at current
      content volume. Pushed live and verified directly against Postgres
- [x] Retrofit: all 12 existing quests read for their real style, not
      defaulted or balanced artificially — 11 `pure`, 1 `educational`
      (`the-careless-counter`, the only one with a genuine in-house
      concept primer). Organized into the platform's first actual Mastery
      Path (`backend-engineering-foundations`), ordered tier-interleaved
      across all four tracks per §1.5's interleaved-practice citation,
      not track-blocked — Git leads every tier, C/C++ trails every tier,
      matching §1's framing of each
- [x] Functional Paths browsing/filtering UI on `/quests`, replacing the
      tag-pill-only filter. Closes this phase at "works and is organized
      correctly," the same bar Phase 6 shipped at — the deeper research-led
      presentation pass for Educational/Pure and progression visualization
      is its own phase (8), same relationship Phase 7.5 had to Phase 6.
      Verified live in a real browser (not just a clean build): correct
      order, the one `educational` quest visibly distinct, tag filter and
      quest-detail links both intact. See decision 11 for a rendering
      artifact investigated and ruled out as a real bug along the way

**Resumed** — Phase 7.5 cleared its exit checklist (16/40 → 26/40,
re-audit-verified). The remaining items above are back in play.

### Phase 7.5 — UI/UX Redesign, A-to-Z ✅ done
*Inserted ahead of the rest of Phase 7. Full rationale, audit results, and
benchmark research in §2.5. Not a new feature phase — a motion/depth/
hierarchy/gamification-visibility pass over what's already shipped, gated
by a re-run `/impeccable critique` before it's considered done. Closed out
2026-08-08 — closing audit results in §2.5.*
- [x] 7.5.A Motion & elevation design tokens
- [x] 7.5.B Nav height + logo lockup rebuild (found and fixed a real
      mobile-overflow regression along the way — see `docs/TODO.md`)
- [x] 7.5.C Motion applied (hover/focus, route transitions via React's
      `<ViewTransition>`, list entrances) — submission-result entrance
      deferred to 7.5.F on purpose, that's where its visual redesign lands
- [x] 7.5.D Elevation applied, replacing bare borders on every genuinely
      raised surface (nav, mobile dropdown, list containers, two cards);
      tabular row dividers and the quest-detail submissions list untouched
- [x] 7.5.E Real type scale (deliberate use of Tailwind's existing scale,
      not new tokens) + quest/repo catalogs are now card grids, activity
      feed is a real timeline; commit list correctly untouched structurally
- [x] 7.5.F Gamification made visible: `SubmissionStatus` + `BadgePill`
      components, badges surfaced on profile and quest detail (incl. a
      pre-solve "earn this" hint), contrast verified computationally —
      UI only, no new schema/currency, Phase 9 (Gamification) untouched
- [x] 7.5.G Accessibility/robustness: `--ember` contrast fixed, status-dot
      aria alternative, mobile-menu focus trap + Escape (keyboard-tested,
      not just coded), tag-select past 6 tags (verified against real
      9-tag data), `loading.tsx`/`error.tsx`, `next/image` on both avatars
- [x] 7.5.H Verification: full Playwright pass, computed contrast (caught
      and fixed a second real bug — `--signal` also failed light-mode AA),
      Lighthouse (95/100 perf, 100/100 a11y, 0 CLS), dual-agent re-critique
      (16/40 → 26/40, independently verified live), `DESIGN.md` rewritten
      to v2

### Phase 8 — Learning UI/UX ✅ done
*New, inserted 2026-08-09 (decision 10). Same relationship to Phase 7 that
7.5 had to Phase 6: Phase 7 closes with a functionally correct Paths UI,
this phase is the deeper, research-led craft pass on top of it, gated by
real research (not vibes) same as 7.5's benchmark research was, and
plausibly by an `/impeccable critique`-style audit as the exit gate, same
methodology as 7.5 used to close. Needs at least one real, styled,
ordered Mastery Path to design against (Phase 7's retrofit work), not
placeholder content — the same "don't build UI for an empty catalog"
principle already applied once this project (decision 9). Closed out
2026-08-09, see decision 12.*
- [x] Research: firecrawl pass on progressive disclosure (Nielsen Norman
      Group's term for the "hints behind a reveal, not inline" pattern)
      and stepper/timeline UI conventions, grounding both new components
      before writing any code
- [x] Educational vs. Pure visual distinction shipped: `QuestPrimer`, a
      distinct `bg-surface-2` callout ("Before you start") above the
      challenge for the one Educational quest, closed the moment it's
      read, not gated; `ResearchHints`, a closed-by-default native
      `<details>` panel below the challenge for Pure quests' keyword
      pointers, so it reads as an opt-in nudge rather than a disguised
      tutorial. A shared `QuestStyleBadge` (book/compass icon) surfaces
      the distinction on catalog cards too, not just the detail page
- [x] Mastery Path progression UI shipped: `PathStepDot` adapts the
      existing activity-feed connecting-line/dot-node shape (DESIGN.md's
      "live sequence" pattern) to a step sequence: passed (signal
      checkmark), current position (accent ring, gated on a real signed-in
      session), and difficulty fade via `--accent` border opacity across
      the tier-interleaved order, not just implied by list position
- [x] Exit gate: dual-agent `/impeccable critique` (two isolated
      sub-agents, one design review, one detector+browser evidence,
      neither saw the other's output). Found and fixed two real bugs
      before closing, not just a changelog taken on faith, see decision
      12 for detail. Score: 30/40 → ~38/40 post-fix

### Phase 8.5 — Paths Information Architecture & Home Redesign ✅ done
*Inserted 2026-08-09 (decision 13), same relationship to Phase 8 that 7.5
had to Phase 6 and Phase 8 had to Phase 7: a research-grounded UI pass
triggered by direct user critique of what Phase 8 shipped, not a new
feature so much as finishing what "Learning UI/UX" was actually supposed
to mean. Phase 8 solved the quest-detail half of that phase (Educational/
Pure, the per-path progression stepper) but never touched the top-level
browsing structure, which is where the "does this feel like a curated
curriculum" complaint actually lives. Root cause identified during
critique: the data model has only two tiers (`paths` -> `quests`), so
"Backend Engineering Foundations" is one flat, tier-interleaved sequence
with no queryable notion of "Git track" vs "Bash track" at all, no page
redesign fixes that without a schema change underneath it first.*

**Content model** (decision 13): a real third tier, `tracks`, between
`paths` and `quests`. `paths` becomes the top-level category ("Backend
Engineering Foundations"), each `track` is a single-skill ordered quest
sequence (Git, Bash/Linux, Docker, C/C++) belonging to exactly one path,
matching the Path -> Track -> Module hierarchy Codecademy and Pluralsight
both already use in production, not an invented shape. Built as a real
normalized structure per this project's standing "no lightweight
workaround" convention (§3.5's Paths schema, decision 10's re-affirmation
of it), not a client-side grouping of the existing `tags` column. The
existing tier-interleaved cross-track ordering (§1.5/decision 9) is no
longer needed once quests are grouped into single-skill tracks: a track
is naturally difficulty-ordered within one skill, and the interleaved-
practice benefit instead comes from a learner choosing to bounce between
track pages at the category level, which is arguably a more honest
application of that research than forcing interleaving into one flat list.

- [x] `tracks` table + migration: `paths` (unchanged, now the category
      tier) -> `tracks` (new, own `trackIcon` enum) -> `quests` (via
      `track_quests`, replacing Phase 7's `path_quests` entirely). Pushed
      live, verified directly against Postgres
- [x] Re-cut `backend-engineering-foundations`'s 12 quests into 4 real
      tracks (Git/Bash/Docker/C-C++), each internally difficulty-ordered,
      real per-track summary copy written, cross-track interleaving
      dropped as no longer needed
- [x] `/impeccable shape` for the Paths hub: category cards -> track cards
      (icon, quest count, per-track progress) -> track detail (the
      existing Phase 8 stepper, now against a real single-skill sequence
      instead of a flattened 12-item list). Full discovery interview +
      structured brief, user-confirmed before any code
- [x] `craft` the Paths hub (`/paths`, `/paths/[pathSlug]`,
      `/paths/[pathSlug]/[trackSlug]`), 4 new hand-drawn track icons,
      `/quests` narrowed to a standalone/search catalog, nav gained a
      "Paths" link
- [x] Exit gate for the Paths hub: dual-agent `/impeccable critique`.
      Found and fixed three real issues before closing (see decision 14):
      a difficulty-tier border encoding that structurally couldn't clear
      WCAG contrast across its own gradient, undifferentiated track cards,
      and `/quests` silently duplicating `/paths`' content with no stated
      relationship. Score: 30/40 pre-fix to roughly 36/40 post-fix
- [x] `/impeccable shape` for the Home dashboard: **two real states, not
      one** (decision 15): signed-in (progress across active
      paths/tracks, points/rank, a continue-where-you-left-off card, and
      Daily/Standalone quests; activity feed demotes to a secondary
      module or its own `/activity` route) and signed-out (what this
      platform is, who it's for, sign-in CTA, per `docs/PRODUCT.md`'s own
      "should read as premium and self-explanatory to a stranger"
      currently has no page backing it; a signed-out visitor lands on the
      same raw internal activity feed a signed-in user does today)
- [x] Nav/logo pass: the icon mark is illegible at 28px nav scale (dense
      internal detail that only resolves zoomed in, unlike Linear's/
      Vercel's single-geometric-move marks); nav shell itself is flat
      with a hard border, no blur-on-scroll or elevation, undercutting
      the Vercel/Linear/Raycast register the rest of the system already
      commits to
- [x] Custom `not-found.tsx` (decision 15): every `notFound()` call today
      (a bad quest/track slug) falls through to Next's generic default
      404, a jarring drop out of the register every other screen commits
      to. Small and cheap enough to fold in here rather than wait for
      Phase 12's broader error/empty-state audit
- [x] `craft` the Home dashboard (both states), nav/logo pass, and the
      custom 404 once shaped
- [x] Exit gate for the Home dashboard, nav/logo pass, and 404: same
      dual-agent `/impeccable critique` methodology, not a changelog
      taken on faith. Found and fixed two real issues before closing (see
      decision 16): a mobile-menu with no way to dismiss by clicking away,
      and a points stat with no explanation anywhere on the page. Score:
      32/40, detector scan clean across every changed file

### Phase 9 — Gamification Expansion *(was Phase 8)*
- [x] Two-currency system (decision 19): points/rank (leaderboard,
      permanent) vs. spendable Credits, a `credit_transactions` ledger
- [x] Streaks, computed off submission history (decision 18): shaped and
      crafted as its own slice, shipped ahead of the currency/shop work.
      Any passing submission extends a UTC-calendar-day streak; current +
      longest shown on Profile in the `--ember` token DESIGN.md reserved
      for this since Phase 7.5.A
- [x] Shop v1 (decision 20): cosmetic flair/title + a repeatable
      activity-feed feature + admin-addable real-world rewards. Discord
      role integration is tracked separately below, not part of this slice
- [x] Discord role integration at point thresholds (decision 22): a real
      bot extending the existing message-only webhook, self-serve linking
      on Profile, tiers authored via a seed script ahead of the admin
      panel, closes out Phase 9
- [x] Post-solve peer solution visibility (decision 21): unlocks once the
      viewer has personally passed a quest, one entry per peer (their
      first pass), each a link-out card to that peer's actual commit on
      Forgejo, this app has no in-app code viewer
- [x] Leaderboard route (decision 15, shipped decision 17): the
      two-currency system above builds points/rank but has no page that
      surfaces rank against other people; without one, "rank" is only ever
      visible on your own profile, which makes the concept inert. Standard
      on every comparable platform (LeetCode, HackerRank, Codecademy);
      shipped first, ranked by real points already computed from passed
      submissions, ahead of the rest of this phase's currency/streak/shop
      work rather than blocked on it

### Phase 10 — Admin Panel *(was Phase 9)*
- [ ] User list + role management
- [ ] Quest CRUD (retiring `scripts/seed-quests.ts` as the only path to
      publishing a quest)
- [ ] **Path CRUD** (author/order/publish a `paths` row and its
      `path_quests` membership, added per §3.5's decision that Paths are a
      first-class entity, not a tag)
- [ ] Submissions/grading monitor
- [ ] Audit log

### Phase 11 — Market-Driven Content
*New, inserted 2026-08-09 (decision 10). Sequenced after Admin (10)
deliberately, not before: authoring content at the scale this phase
implies ("read a massive amount of modern documentation and industry
standards") through a hand-edited `scripts/seed-quests.ts` array is
exactly the unmanageable pattern Phase 10 exists to retire. Also
sequenced after Learning UI/UX (8) on purpose — new content gets authored
directly against the final presentation model (primer field, hint field,
path placement) instead of needing a retrofit pass later, the same
mistake §1.5's fading principle is designed to avoid at the individual-quest
level, applied here at the content-pipeline level.*
- [ ] Research pass: use `firecrawl`/`context7` against current official
      documentation and named industry-standard sources (not blog-post
      summaries) to identify quest-shaped, high-demand skills, same
      source-quality bar §1's original market research held itself to
- [ ] Author quests through Phase 10's Path/Quest CRUD, not a seed script
- [ ] Recalibrate existing difficulty/style labels against real
      `duration_ms`/pass-fail data once volume justifies it, per §1.5's
      labels-are-estimates principle

### Phase 12 — Platform Hardening & Missing-Feature Pass *(was Phase 10)*
*Last gate before beta invite.*
- [ ] Quest search/filter, submission history page, public profiles
- [ ] Discussion/hints per quest (Discord-linked is an acceptable v1)
- [ ] Rate limiting on auth/webhook, RBAC role enum, audit log wired to
      the admin actions that exist by this point
- [ ] Error/empty states audited across every surface (Playwright,
      375/768/1280px, per this project's existing UI QA standard)

### Phase 13 — AI Qualitative Review *(was Phase 11, still deliberately last)*
Kept exactly where it already was — a separate, later slice on top of the
deterministic grading engine, not folded into any of the above.

**Beta invite happens after Phase 12's checklist is genuinely clear**, not
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
4. **UI/UX Redesign inserted as Phase 7.5** (§2.5): triggered by direct
   feedback on the shipped Phase 6 re-skin plus a dual-agent
   `/impeccable critique` audit (16/40). Scoped as a visual/motion/
   hierarchy pass over the existing product, not new mechanics — the
   two-currency/streak/shop gamification economy stays in Phase 9
   (Gamification) untouched. The rest of Phase 7 (`dockerfile-check`, `git-assert`, more
   Foundations content, Paths browsing) pauses until 7.5 clears its exit
   checklist, per the standing peak-potential rule.
5. **Motion/tooling for the redesign**: no new MCP server, skill, or
   plugin needed — `/impeccable` (design/critique/build), `context7`
   (library docs), `firecrawl` (benchmark research), and `playwright`
   (verification) already cover the full loop. Motion implementation
   stays CSS-first (transitions/transforms, the View Transitions API for
   route changes) rather than adding an animation-library dependency,
   unless 7.5.C hits a concrete gap CSS can't cover — consistent with the
   "performance first" constraint and this project's existing
   no-unnecessary-dependency posture.
6. **Phase 7.5 closed** (2026-08-08): 16/40 → 26/40, re-audit-verified
   live by an independent dual-agent pass, not a rubber-stamped changelog
   read. Live-updating submission status (SSE/polling on the quest-detail
   submissions list) explicitly deferred as real-time infrastructure work,
   not UI polish — tracked as a follow-up alongside Phase 9
   (Gamification), not silently dropped. Phase 7's remaining
   runner/content items resume.
7. **`git-assert` runner shipped** (2026-08-08), picked as the next Phase 7
   slice over `dockerfile-check` deliberately — lower novel security risk
   (inspects git history via fixed plumbing commands, doesn't execute
   anything the submitter wrote, unlike Docker-in-Docker's much larger
   attack surface). Confirmed a real architectural correction along the
   way: the original plan's "reflog structure" assertion example isn't
   actually viable — reflog is local-only and never transferred by a
   clone — so the shipped assertion set (no-merge-commits, commit-count,
   commit-message-matches) is scoped to what commit ancestry can actually
   verify. Real E2E run against the live Forgejo instance and real
   existing commits, not just fixtures, before trusting it.
8. **`dockerfile-check` runner shipped** (2026-08-09), closing out Phase
   7's runner set, all four Foundations tracks now have a working runner.
   Split into a standalone security PoC first, then integration, per the
   user's explicit request for a Phase-0-style hardened proof of concept
   before any wiring into `judge.ts`. Rejected Docker-in-Docker outright
   (no privileged flag, no daemon socket, no Sysbox host dependency) for
   Kaniko's unprivileged, daemonless builds, gated by a squid
   egress-allowlist sidecar reachable only from a Docker `--internal`
   network with no WAN route of its own, that missing route being the
   actual containment guarantee rather than the proxy env vars a
   malicious `RUN` step could simply unset. The PoC alone found and fixed
   six real bugs before integration started; full detail is in
   `infra/sandbox-dockerfile-check/README.md`. Real E2E confirmed against
   the live compose stack afterward: a clean pass, an assertion-level
   fail with per-check detail, and the PoC's own exfiltration fixture
   re-run through the production wiring, still hitting the same squid
   403.
9. **Content buildout picked over Paths browsing UI** (2026-08-09) as the
   next Phase 7 step, once all four runners existed. Reasoning: three of
   four Foundations tracks (Bash, Git, Docker) had exactly one quest each,
   a proof point, not a track. Building a browsing/organization layer for
   a nearly empty catalog would have delivered little real value and
   risked rework once real content patterns emerged, while thin content
   was the actual gap standing between the platform and real usage.
   Shipped two new quests per thin track, bringing every track to parity
   with C/C++'s existing three. Writing this content directly caught two
   more real bugs in already-shipped grading code: `io-match`'s stdin
   handling silently dropped a submission's last input line whenever a
   case's stdin ended in a newline (a bash command-substitution quirk
   affecting the already-live `extract-failed-logins` quest, not just new
   content), and `dockerfile-check`'s `has-healthcheck` assertion could
   never pass, since `skopeo inspect --config` silently drops the
   `Healthcheck` field even when genuinely present. Both fixed and shipped
   as their own PRs before the content that depended on them, and both
   are more evidence for the same pattern as every prior runner bug in
   this project: build real content against a runner and it will surface
   gaps that fixture-only testing didn't reach.
10. **Learning methodology formalized, two phases inserted** (2026-08-09).
    Research-grounded content methodology adopted (§1.5): Educational vs.
    Pure as an orthogonal style axis, Mastery Path vs. Standalone as an
    orthogonal structure axis, style fading across a path per the
    faded-worked-examples research, labels treated as estimates
    recalibrated against real submission data rather than fixed truths.
    Paths get a real normalized relational schema (§3.5, `paths` +
    `path_quests` join table with `order_index`, plus `quests.style`) per
    explicit direction to build it correctly now rather than retrofit a
    lightweight shortcut later, even though current content volume doesn't
    strictly require it yet. Two new phases added to the roadmap and
    everything after them renumbered accordingly (see the phase-numbering
    note near the top of this document): Phase 8, Learning UI/UX, a
    dedicated research-led design pass for presenting Educational/Pure and
    path progression, sequenced right after Phase 7 the same way 7.5
    followed Phase 6; and Phase 11, Market-Driven Content, a
    firecrawl/context7-backed research phase for job-market-relevant
    content, deliberately sequenced after Admin (10) since authoring at
    that scale needs real CRUD tooling, not a hand-edited seed script, and
    after Learning UI/UX (8) so new content is authored directly against
    the final presentation model instead of needing a later retrofit.
11. **Phase 7 closed** (2026-08-09): the Paths schema (§3.5) shipped as
    designed, all 12 existing quests retrofitted with a real `style`
    value (11 `pure`, 1 `educational`, an honest empirical split, not
    balanced for variety), organized into the first Mastery Path with a
    tier-interleaved ordering, and a functional Paths browsing UI shipped
    on `/quests`. One rendering artifact investigated during browser
    verification and ruled out as a real defect: hard/direct URL
    navigation via the browser-automation tool intermittently left a
    stuck `InvalidStateError: Transition was aborted` from React's
    `<ViewTransition>` wrapper, which visually looked like most quests
    missing from a screenshot. Confirmed not a real bug two ways: direct
    DOM inspection showed all 12 items at `opacity: 1` with correct
    layout the whole time, and the identical stuck-overlay artifact
    reproduced on the untouched home Activity feed page, which nothing in
    this work touched. Real in-app `Link` navigation (the actual user
    path, not a hard reload) never showed it. All four Foundations
    runners, 12 quests across 4 tracks, and a real Paths structure now
    exist — Phase 8 (Learning UI/UX) is next.
12. **Phase 8 closed** (2026-08-09): `quests` gained `primerMarkdown`
    (nullable, Educational quests only) and `researchKeywords` (array,
    Pure quests only), splitting a primer out of the single
    `promptMarkdown` blob it used to share with the challenge. The
    dual-agent `/impeccable critique` exit gate (two isolated sub-agents,
    a design review and a detector+browser-evidence pass, neither seeing
    the other's output) found two real bugs, both fixed and verified live
    before closing:
    - **P0, pre-existing and app-wide, not a Phase 8 regression**:
      `globals.css`'s `* { border-color: var(--line) }` was unlayered, so
      per the CSS Cascade Layers spec it beat every layered
      `border-{color}` Tailwind utility in the app regardless of
      specificity or source order. This had already been silently
      flattening `BadgePill`'s and the `systems` tag's intended violet
      borders to plain grey; Phase 8's difficulty-tier stepper was just
      the first feature whose entire signal depended on it, so the first
      to visibly fail. Fixed by wrapping the rule in `@layer base`, which
      repaired the two older components as a side effect.
    - **P1, new**: the path stepper's "current step" ring was computed
      without checking for a signed-in session, so it rendered on quest 1
      for every visitor, signed in or not, contradicting the feature's
      own intent of marking real progress. Fixed by gating
      `currentQuestIdByPath` on `session`.
    Score: 30/40 pre-fix to roughly 38/40 post-fix, independently
    verified live in both themes after the fixes, not re-scored on
    faith. All four Foundations runners, 12 quests, a real Paths
    structure, and the Educational/Pure plus progression UI now exist,
    Phase 9 (Gamification Expansion) is next.
13. **Phase 8.5 inserted** (2026-08-09), direct user critique of the
    shipped Phase 8 UI: the Paths page reads as a flat numbered list, not
    a curated curriculum, and the nav/logo don't carry the premium feel
    the rest of the design system commits to. Root cause traced to the
    data model, not the UI: `paths` to `quests` is only two tiers, so
    there is no queryable "Git track" versus "Bash track", only informal
    `tags` strings on individual quests. Decision: add a real third tier,
    `tracks`, between `paths` and `quests`, matching the Path/Track/
    Module hierarchy Codecademy and Pluralsight both already use in
    production rather than inventing a shape from scratch. Sequenced as
    an insertion ahead of Phase 9 (mirroring how 7.5 was inserted ahead
    of Phase 7), not folded back into the now-closed, already-scored
    Phase 8. Planned execution: `/impeccable shape` per surface (Paths
    hub, then Home dashboard), a targeted nav/logo pass, `craft` once
    each plan is signed off, and the same dual-agent `/impeccable
    critique` exit gate the last two UI phases used. Full rationale in
    the Phase 8.5 section above.
14. **Paths hub shipped and closed** (2026-08-09): the `tracks` table and
    `track_quests` join (fully replacing `path_quests`) shipped exactly to
    the shape brief's normalized shape, with an explicit `trackIcon` enum
    per decision 13. All 12 quests re-cut into 4 real single-skill tracks.
    Three new routes (`/paths`, `/paths/[pathSlug]`,
    `/paths/[pathSlug]/[trackSlug]`) built, `/quests` narrowed to a
    standalone/search catalog now that its inline path section moved out.
    The dual-agent `/impeccable critique` exit gate found and fixed three
    real issues before closing:
    - **Difficulty-tier border encoding structurally couldn't clear WCAG
      contrast.** The `PathStepDot` component (reused from Phase 8) faded
      difficulty via `border-accent`'s opacity (30/65/100%). Computed
      contrast (WCAG relative-luminance math, not eyeballed) showed even
      the 65% "medium" tier only hit 2.80:1 in light mode, under the 3:1
      non-text-UI threshold, and opacity structurally can't clear that bar
      across a 3-step gradient on this palette. Fixed by decoupling color
      from difficulty entirely: border color now stays solid
      `border-accent` (5:1+ in both themes) for every tier, difficulty
      fades via border width (1px/2px/4px) instead, which can't fail a
      color-contrast check because it isn't a color. Caught a real
      implementation bug in the first version of this fix too: color
      without an explicit width/style utility renders no border at all in
      Tailwind, silently making the "easy" tier invisible until corrected.
    - **Track cards read as the same template with a swapped icon.**
      Fixed by surfacing each track's real, already-uniform grading
      method (git-assert, io-match, dockerfile-check, sandbox-exec) as a
      caption, tying directly to the platform's own stated differentiator
      (`docs/PRODUCT.md`: verifies what it grades, not just diffs stdout)
      instead of adding decoration.
    - **`/quests` silently duplicated 100% of `/paths`' content.** Every
      published quest today is a track member, so the two pages showed
      identical content with no stated relationship. Fixed with a "Part
      of [Track]" line on `/quests` cards, computed from a real join.
    Score: 30/40 pre-fix to roughly 36/40 post-fix, re-verified live in
    both themes after every fix. Two P3s deliberately deferred, not
    fixed: no lateral track-to-track navigation from a track detail page,
    and `/paths`' single-path sparseness (an honest, temporary consequence
    of current content volume, not a page-design flaw). Home dashboard
    and the nav/logo pass remain open in Phase 8.5.
15. **Full page-inventory audit** (2026-08-09): a Principal-UX-Architect
    pass over the entire route structure, prompted by a direct question
    about the Profile page and what else the architecture is missing
    relative to comparable platforms (Codecademy, Pluralsight, LeetCode,
    HackerRank). Findings:
    - Profile itself needs no new phase work, its real gaps (points/rank,
      streaks, submission history, public profiles) are already correctly
      scoped into Phase 9 and Phase 12, word for word.
    - `/` has no distinct signed-out state: a stranger lands on the same
      raw internal activity feed a signed-in user does, contradicting
      `docs/PRODUCT.md`'s own "should read as premium and
      self-explanatory to a stranger." Folded into Phase 8.5's
      already-open Home dashboard item as a second required state, not
      treated as separate new work.
    - No custom 404 (`notFound()` calls fall through to Next's generic
      default page). Small and cheap enough to fold into Phase 8.5's
      nav/logo pass rather than wait for Phase 12's broader audit.
    - No leaderboard route: Phase 9 builds points/rank but has no page
      that makes "rank" mean anything against other people. Added
      explicitly to Phase 9's checklist, it's inert without that phase's
      own currency system underneath it, so it doesn't belong earlier.
    - Explicitly recommended against building yet: an in-app notification
      center (Discord already serves a ~14-person circle already on
      Discord, matches §0.5's standing "don't pull forward public-facing
      complexity" principle) and a dedicated onboarding flow (premature
      for an invite-only circle that mostly knows each other; the Home
      dashboard's continue-where-you-left-off card is enough for now).
    No phase renumbering, no new phase inserted, existing sequencing
    (8.5 now, 9 next) confirmed correct.
16. **Phase 8.5 closed** (2026-08-10): Home dashboard (signed-in progress
    view + signed-out landing), a dedicated `/activity` route (the old
    home page's live cross-user feed, moved wholesale), a new single-shape
    `LogoIcon` mark (a chamfered rounded square replacing a dense
    multi-path illustration illegible at 28px nav scale), sticky nav with
    backdrop-blur and scroll-driven elevation, and a custom `not-found.tsx`
    all shipped. Two real decisions made mid-build, not scope creep:
    - Points render as a real computed sum (passed-submission points,
      total) with **no rank**, since Phase 9's leaderboard doesn't exist
      yet; a placeholder rank would violate this project's own "verify,
      don't just check" principle applied to its own UI, not just its
      grading.
    - "Daily quests" from the original roadmap language became "standalone
      quests" (published quests with no track), since there is no
      daily-rotation mechanic in the schema, and building one now would be
      new scope disguised as a UI pass.
    - The nav's inline-link breakpoint moved from `sm:` to `lg:` mid-build,
      found empirically: five links plus the wordmark plus the auth button
      overflowed at both 640px and 768px (the wordmark ran directly into
      "Paths" with zero gap at 768px, caught in a real screenshot, not
      guessed).
    The dual-agent `/impeccable critique` exit gate found and fixed two
    real issues before closing: a mobile-menu dropdown with no way to
    dismiss by clicking away (this phase's own breakpoint move widened who
    hits it, from phone-only to tablet widths too, fixed with a
    click-outside handler, deliberately not a modal scrim, matching this
    project's own dropdown-vs-modal z-index distinction), and a points
    figure with no explanation anywhere on the page (fixed with a plain
    tooltip; a link to `/profile` was considered and rejected since that
    page's own placeholder still disclaims points as not-yet-built).
    Score: 32/40, detector scan clean across every changed file. Phase 9
    (Gamification Expansion) is next, not yet started.
17. **Leaderboard route shipped** (2026-08-11), the first slice of Phase 9,
    taken through `/impeccable shape` → `craft` on its own rather than
    waiting for the rest of the phase's currency/streak/shop work — the
    shape brief scoped it to rank off the real points total that already
    existed (`dashboard.ts`'s passed-submission sum), not a placeholder for
    the not-yet-built two-currency system, matching decision 16's own
    "verify, don't just check" stance applied to this UI. Public, not
    auth-gated: a mid-build discovery found `/activity` (cross-user
    platform state) has no session check at all despite the shape brief's
    initial assumption it was gated "like Activity/Profile" — that
    assumption was simply wrong, `/activity` and `/profile` aren't
    consistent with each other, so the user picked public-like-Activity
    explicitly rather than the brief's guess standing uncorrected.
    A real correctness gap surfaced along the way: `dashboard.ts`'s
    `pointsEarned` only sums points from quests inside a published track,
    silently excluding standalone published quests — fine for Phase 8.5's
    own narrower need, but wrong for a global ranking, so the leaderboard
    computes its own total (every passed submission against a published
    quest, tracked or standalone, deduped by quest id) rather than reusing
    that narrower helper. Flagged to the user rather than silently fixed as
    a drive-by change on an already-shipped Phase 8.5 surface; the user
    asked for the fix, so `dashboard.ts`'s `pointsEarned` now sums the same
    way — every passed+published quest, deduped by quest id, tracked or
    standalone — and both computations agree. Dual-agent-equivalent
    `/impeccable` layout + typography assessments (isolated
    assessment-then-pre-scan pairs, both scopes) found one real issue
    each: a stale nav comment left over from the Phase 8.5 breakpoint
    move (now six links, not five — re-verified at 1024px/768px, no
    breakpoint change needed) and the points figure sized `text-sm` where
    DESIGN.md's own scale and the `quests/page.tsx` precedent both call
    for `text-xs` metadata sizing (also flattened the row's two-tier size
    hierarchy as a side effect). Both fixed before shipping. Detector
    pre-scans clean on both scopes across both changed files.

18. **Streak tracking shipped** (2026-08-12), the second slice of Phase 9,
    shaped and crafted as its own cycle rather than folded into the
    currency/shop work. Shape discovery settled three open questions, all
    the recommended defaults: any passing submission extends the streak
    (including a resubmit of an already-passed quest — matches GitHub's
    contribution-streak model, and gaming it isn't a real risk at 14
    trusted people); Profile-page only for this slice, not home dashboard
    or nav; hard reset on a missed day, no grace/freeze mechanic. Computed
    server-side in `server/streak.ts` off `questSubmissions.submittedAt`,
    grouped by UTC calendar day (not per-user local time — avoids real
    timezone state for a v1); "today" counts as still-alive even before
    the user has submitted anything today, so visiting your own profile
    mid-day doesn't show a false break. Fills the exact placeholder the
    Profile page's Streak card has held open since Phase 7.5.F ("streak
    and points fill in once gamification lands") using `--ember`, a token
    DESIGN.md reserved for "streaks/warnings" back in Phase 7.5.A but that
    had never actually rendered in UI chrome (only syntax highlighting)
    until this shipped. Verified in-browser across all three states
    (never-submitted, broken/0-day-with-a-longest-streak, active) in both
    themes; the broken-streak state used real production data (a genuine
    2-day streak that had lapsed), the active state used a temporary
    reverted render override rather than fabricated database rows, same
    non-destructive-verification discipline as decision 17's leaderboard
    "you" row.

19. **Spendable currency (Credits) shipped** (2026-08-12), the third slice
    of Phase 9 — the schema half of the two-currency model named in the
    original TODO item ("permanent points/rank vs. spendable shop
    currency"). Shape discovery settled three open questions, all the
    recommended defaults: credits earn one-time per quest passed (deduped
    by quest id, same as points — not per submission like the streak
    model); earn amount is 1:1 with the quest's point value; balance shown
    on Profile now even though Shop v1 (where it gets spent) doesn't exist
    yet, so the feature has a visible, verifiable result. A fourth
    decision, made during craft rather than discovery: `credit_transactions`
    is a ledger table (userId, signed amount, reason enum
    `quest_passed`/`admin_grant`/`shop_purchase`, nullable questId, nullable
    admin-grant note), balance computed as `sum(amount)` on read — same
    "derive from source of truth, never cache a running total" posture as
    points/streak already use, and it gives Shop v1's purchases and the
    TODO's planned admin-addable manual reward line items a natural home as
    rows in the same table with a real audit trail, rather than a single
    mutable balance column. A `unique(userId, questId)` constraint makes
    the earn-on-pass insert idempotent against a retried grading job
    (Postgres treats NULLs as distinct, so admin_grant/shop_purchase rows
    never collide with each other on that constraint). Earning is wired
    into `judge-worker.ts` right after the existing status update, same
    placement and `onConflictDoNothing()` idempotency shape as
    `awardBadgesIfEligible`; a one-time `scripts/backfill-credits.ts`
    (`npm run db:backfill-credits`) retroactively credited every
    already-passed submission so no one's balance started at 0 while their
    leaderboard points total didn't — run once against production,
    verified to match each user's points total exactly (180 for the one
    user with real passed submissions at the time). One real bug caught
    during in-browser verification, not by typecheck or lint: `credits.
    toLocaleString()` with no explicit locale rendered as Eastern Arabic
    numerals (`١٨٠` instead of `180`) under the server's runtime default
    locale — fixed by passing `"en-US"` explicitly. Verified in-browser
    across empty and active states in both themes using the same
    non-destructive temporary-session-override discipline as decisions 17
    and 18. A `/code-review` pass surfaced six real fixes, applied before
    shipping: `questId`'s FK was `onDelete: "cascade"`, contradicting the
    "credits are permanent history" invariant — a hard-deleted quest would
    have silently erased every credited user's balance for it, changed to
    `set null`; the (userId, questId) unique constraint wasn't scoped by
    `reason`, so a future admin_grant tied to a quest a user already passed
    would've silently no-opped — closed with a CHECK constraint enforcing
    `questId` is null unless `reason = 'quest_passed'`; `getCredits`
    returned a bare number, unable to distinguish "never earned" from "earned
    a real 0-point quest," fixed by mirroring streak's own
    `hasEverPassed` pattern (`{ balance, hasEarned }`), with
    `awardCreditsIfEligible` returning `number | null` to match; badge- and
    credit-awarding in `judge-worker.ts` were sequential despite being fully
    independent, parallelized with `Promise.all`; `awardCreditsIfEligible`
    re-fetched the quest row the caller already had loaded, now takes
    `questPoints`/`questStatus` directly; `backfill-credits.ts` rewritten
    from a 2N-round-trip per-row loop to one joined query plus a single
    bulk insert. Two findings (sharing an award helper with `badges.ts`;
    extracting a shared "published" check shared with `points.ts`) were
    judged premature abstraction and left as-is. Re-verified clean after:
    typecheck, lint, build, a re-run of the (idempotent) backfill script,
    and a repeat in-browser screenshot pass confirming the `ProfileCard`
    extraction (the sixth fix, deduplicating what was by then three
    near-identical stat-card shells on the page) changed no pixels.
20. **Shop v1 shipped** (2026-08-12), the fourth slice of Phase 9: what
    Credits are actually for, closing the loop Credits (decision 19) opened
    by shipping the balance with nowhere to spend it yet. Shape discovery
    (two rounds) settled the full catalog in one slice rather than staging
    it: cosmetics (flair + title, owned forever, equip one of each at a
    time), a repeatable "Spotlight" activity-feed feature, and admin-added
    real-world reward line items, matching the TODO item as written rather
    than deferring pieces. Purchases require an explicit confirm dialog
    (price + resulting balance) since Credits spending has no refund path;
    equipping is free and instant, no confirm needed. New tables:
    `shop_items` (slug/name/description/category/price, nullable
    `flairGlyph` icon key, `repeatable`, nullable `stock` for admin-capped
    real-world rewards), `shop_purchases` (one row per redemption, a
    financial record: its `itemId` FK is `onDelete: "restrict"`, never
    cascade/set null; retiring an item is `active: false`, never a delete),
    and `equippedCosmetics` (one row per user per category, upserted on
    equip), deliberately not columns on `user`, which is Better
    Auth-owned and never hand-edited. No admin panel exists yet (Phase 10),
    so the catalog is authored via `scripts/seed-shop-items.ts`
    (`npm run db:seed-shop-items`), the same precedent `seed-quests.ts` set
    for quests before an admin UI existed. `purchaseItem()` row-locks the
    item (`for("update")`) inside a transaction so two concurrent buyers
    can't both clear a capped reward's stock check before either insert
    lands, then checks ownership (for non-repeatable items), stock, and
    balance before writing a `shop_purchases` row and a negative
    `credit_transactions` row together: the same ledger `credits.ts`
    already writes to, so a purchase is just another signed row, not a
    parallel accounting system. The "featured on Activity" effect matches
    on `user.name` against the webhook's raw `pusher` string, the same
    loose identity link the rest of the activity feed already relies on,
    good enough at 14 trusted users, not a general-purpose join. Equipped
    flair/title now render on both Profile and the leaderboard (a
    deliberate scope expansion during shape discovery, past the brief's own
    "Profile only" recommended default) via one batched
    `getEquippedForUsers()` lookup rather than a per-row query. Verified
    with the same discipline as decision 19: typecheck, lint, build, and
    in-browser screenshots across both themes and mobile/1024px/desktop
    widths using the same non-destructive temporary-session-override
    pattern. The purchase/equip transactional logic itself was verified by
    calling `purchaseItem`/`equipItem` directly against the real dev
    database (covering the owned/already-owned, repeatable-repurchase, and
    insufficient-credits paths) rather than through the browser, since the
    `/api/shop/*` routes require a real Better Auth session that a
    server-rendered-page bypass doesn't provide. Every test purchase was
    deleted immediately after and the balance re-verified to match its
    pre-test value exactly. One real bug caught in-browser, not by
    typecheck or lint: the confirm dialog's "Balance after" row rendered
    flush against its value with no gap at the dialog's `max-w-sm` width
    (`justify-between` had no free space left to distribute), fixed with
    an explicit `gap-3` and a shorter "New balance" label. A `/code-review`
    pass surfaced ten findings, six fixed before shipping: `purchaseItem()`
    only row-locked the item being bought, not the buyer, so two concurrent
    purchases of two *different* items could both read the same pre-commit
    balance and both pass the affordability check, closed with a
    `pg_advisory_xact_lock` keyed on the buyer that serializes a user's
    purchases against each other regardless of item; the leaderboard's
    name/title truncation was broken (a flex child needs `min-w-0` for
    `truncate` to actually engage, and `shrink-0` combined with `truncate`
    on the title span meant it never fired), fixed with `min-w-0 flex-1`
    on the name and `min-w-0 shrink` on the title; repurchasing "Spotlight"
    while a boost was already active silently replaced the window with no
    indication anything was running, fixed with an inline "already active
    until" note; the leaderboard's equipped-cosmetics lookup ran as an
    extra sequential round trip after its own `Promise.all` instead of
    inside it, fixed by making `getEquippedForUsers()`'s `userIds` filter
    optional (an unfiltered scan of a small table costs nothing extra) so
    it can join the same `Promise.all` as the user query it used to wait
    on; `purchaseItem()` re-derived the Credits balance with its own
    aggregation instead of reusing `credits.ts`'s definition, fixed by
    extracting a shared `getCreditsBalance()` that accepts either `db` or
    an in-flight `tx`; and this decision entry itself used em dashes as
    mid-sentence punctuation in new documentation prose, a direct violation
    of a standing user rule, fixed by rewriting throughout. Four findings
    were judged accepted tradeoffs or premature abstraction and left as
    is: `user.name`-based featured-post matching having no uniqueness
    guarantee (a pre-existing, already-disclosed limitation the rest of
    the activity feed already lived with, now elevated from cosmetic to
    "spent real currency" but not worth a general-purpose identity join
    for 14 trusted users); the equippable-category check
    (`flair`/`title`) duplicated as a hardcoded string comparison on both
    client and server; `equipItem`/`purchaseItem` each running their own
    small independent ownership-check query; and the `Section` component's
    three call sites repeating identical `balance`/`ownedItemIds`/
    `equippedByCategory` props, which TypeScript already catches at all
    three sites simultaneously if any one of them drifts.
21. **Peer solution visibility shipped** (2026-08-14), the fifth slice of
    Phase 9. Shaped via a standalone `/impeccable shape` run, one discovery
    round: the peer list only unlocks after the viewer has personally
    passed the quest (so it can never be browsed as a shortcut past the
    challenge itself, not even the count or names); each entry is a
    link-out card, avatar, name, badges earned, passed date, opening the
    peer's actual commit on Forgejo, since this app has no in-app code
    viewer anywhere and building one was explicitly out of scope for this
    slice; and a peer who resubmitted and passed more than once still gets
    exactly one entry, keyed to their first pass. No schema changes: the
    feature reads entirely from tables that already existed
    (`quest_submissions`, `badges`, `commits`, `user`). New file
    `server/peer-solutions.ts`: `getPeerSolutions()` fetches every passed
    submission for the quest except the viewer's own ordered oldest first,
    reduces to one row per user in JS (the same "reduce in application
    code rather than a window-function query" style this codebase already
    uses elsewhere at this scale), then sorts newest-first and caps at 50,
    a limit rather than real pagination, revisited only if a quest's pass
    count ever approaches it for real. Each entry's Forgejo link is
    resolved by joining `commits` on the `(repoId, sha)` pair, not `sha`
    alone, matching that table's own uniqueness and staying correct even
    though a cross-repo sha collision is practically impossible anyway.
    The "has the viewer passed" gate reuses the quest detail page's own
    already-fetched submissions query instead of a second round trip.
    Section placed directly below "Your submissions" on the quest detail
    page, reusing that section's exact row-list shape (`divide-y`,
    `reveal-list`, `shadow-resting`) so the two read as one family. Verified
    with the same discipline as decisions 19 and 20: typecheck, lint, and
    build clean, plus in-browser screenshots across both themes,
    375/1280px, using the established non-destructive temporary-session
    pattern together with two temporary peer rows (one with an avatar and
    a badge, one without) inserted directly into the dev database to
    actually exercise the populated state, since there is currently only
    one real user in this environment; both rows and their author were
    deleted immediately after and the underlying tables reverified to hold
    only the pre-existing real data. One real bug caught in-browser, not
    by typecheck or lint: at 375px the badge-plus-date group was
    `shrink-0` sharing a row with a name that needed real space, squeezing
    a two-letter name down to one visible character before it even had a
    chance to truncate cleanly; fixed by stacking name above badges/date
    under the `sm` breakpoint, the same responsive shape the repo detail
    page's own header already uses for an equivalent problem.
22. **Discord role integration shipped** (2026-08-16), the sixth and final
    slice of Phase 9, closing the phase out. Shaped via a standalone
    `/impeccable shape` run: unlike every other Phase 9 slice this one is
    mostly infrastructure, not UI, extending the existing Discord webhook
    (`discord.ts`, message-only) with a real bot capable of assigning
    server roles. Discovery settled three things: linking is self-serve (a
    plain Discord-ID text field on Profile, trust-based like the
    pusher-name match `shop.ts` already relies on at this scale, not a full
    OAuth handshake); tiers are authored via a new
    `npm run db:seed-discord-tiers` script against a new
    `discord_role_tiers` table (threshold, role ID, label), the same
    ahead-of-the-admin-panel precedent `seed-shop-items.ts` set; and
    crossing into a new tier replaces the old tier role rather than
    accumulating every tier ever earned, so a member's roles always read as
    current standing. New table `user_discord_links` (one row per user,
    re-linking overwrites). New `server/discord-roles.ts`: `syncDiscordRole()`
    computes total points via the same `sumPassedQuestPoints` helper
    leaderboard.ts/dashboard.ts already share, diffs the member's current
    Discord roles against the configured tier list, and only calls the
    Discord API for an add/remove if something would actually change.
    Mirrors `discord.ts`'s exact best-effort posture: silently no-ops when
    `DISCORD_BOT_TOKEN`/`DISCORD_GUILD_ID` are unset, never throws, logs a
    warning and skips cleanly if the linked user isn't a guild member.
    Triggered from `judge-worker.ts` right after credits/badges are
    awarded, on every passed submission (confirmed with the user rather
    than assumed); also triggered once inline right after a user links
    their Discord ID, so linking reflects current standing immediately
    instead of waiting for the next pass. Unlinking stops future syncs but
    doesn't strip an already-assigned role, matching the "already-earned
    isn't clawed back" posture `credits.ts` set for Credits. `.env.example`
    documents full bot setup (create the application, add a bot, invite it
    with Manage Roles, and critically, drag the bot's own role above every
    tier role in Server Settings, the single most common way this class of
    integration silently does nothing) since the user had no bot configured
    yet at shape time. Verified what's actually verifiable without real
    Discord credentials: typecheck/lint/build clean; the link/unlink UI
    live in-browser across both themes and 375/1280px (using a real
    temporary DB row for the linked state, deleted afterward); and
    `syncDiscordRole`'s branching logic (add+remove together, already-
    correct no-op, member-not-found, fully-unconfigured no-op, and a
    thrown network error) individually exercised against a stubbed `fetch`
    in throwaway scripts, since there is no bot token/guild available in
    this environment. The real end-to-end Discord API call is unverified
    until the user configures a bot and tests it live.

    A separately user-triggered `/code-review` pass surfaced 3 findings, all
    triaged as real and fixed: a role add/remove call whose HTTP response
    was never status-checked (so a 403, most likely from the bot's role
    sitting below a tier role, would log as a false "synced" success — now
    each write is checked individually and a partial failure is logged, not
    swallowed); `getTotalPoints` and the Discord member fetch running
    sequentially instead of via `Promise.all`; and `syncDiscordRole` being
    awaited inside `judge-worker.ts`, needlessly holding a scarce
    grading-worker concurrency slot (as low as 2 for `sandbox-exec`) for a
    Discord round trip nothing later in the job depends on, fixed by firing
    it without awaiting (`void syncDiscordRole(...)`, safe since the
    function is fully try/catch-wrapped and never throws). A separately
    user-triggered `/security-review` pass (the full 3-step sub-agent
    process) found one real Medium-High finding at 8/10 confidence: linking
    never verifies the caller actually owns the Discord ID they typed in
    (no OAuth handshake against Discord), and the original `userDiscordLinks`
    schema had no uniqueness constraint on `discordUserId`, so a second Hub
    account could silently take over write-control of a Discord ID another
    user had already linked, causing that victim's real server role to
    flap according to a stranger's unrelated point total. The reviewer
    correctly distinguished this from `shop.ts`'s `getActiveFeaturedNames`
    trust-based name match cited as precedent in the original design brief:
    that one is read-only and only mislabels a cosmetic UI badge, while
    this one is a privileged write against a real external Discord account
    via the bot's Manage Roles permission. Per explicit user direction, shipped
    the minimum viable mitigation rather than the full fix: `discordUserId`
    is now `unique()` in the schema, `linkDiscordAccount` catches the
    resulting Postgres `23505` (unique_violation, unwrapped from Drizzle's
    wrapping `DrizzleQueryError.cause`, confirmed against a real thrown
    error rather than assumed from docs) and returns a new `already_linked`
    result instead of a 500, and the API route/client surface it as a 409
    with a clear message. Verified live against the dev DB with two real
    throwaway users: a second account claiming an already-linked ID is
    cleanly rejected, while a user re-linking their own row to a different
    ID still works. The core missing-ownership-proof gap (anyone can still
    claim any *unclaimed* real Discord ID) is explicitly NOT fixed by this
    mitigation and remains open — closing it properly would need a Discord
    OAuth `identify` handshake or a confirmation-challenge flow, deliberately
    out of scope for this pass. Phase 9 (Gamification Expansion) is now
    fully closed.
