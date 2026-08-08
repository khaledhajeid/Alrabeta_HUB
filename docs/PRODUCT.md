# Product

## Register

product

## Platform

web

## Users

Two audiences on two different timelines, not a single static answer.
**Right now**, this is invite/admin-provisioned only — a small private
circle (~14 people, mostly 42 Amman alumni) using it to practice real
backend-engineering skills. **The architecture, data model, and UI must not
assume that's the ceiling.** The ultimate audience is junior-to-mid
developers validating backend skills more broadly (regionally or
globally); the platform is deliberately being built to scale to hundreds
or thousands of users even while the actual rollout stays invite-only for
now. Content and UI should read as a premium, general-purpose product —
no inside jokes, no hardcoded assumptions specific to the current circle
— even though today's real users are that circle.

## Product Purpose

A gamified developer-skills practice platform: hands-on quests (Git,
Bash/Linux, Docker, C/C++ systems programming, and more over time),
graded by real sandboxed execution rather than superficial output
matching, with a badge/points system built around genuinely earning
verified results. What makes it different from the obvious LeetCode/
HackerRank comparison is that grading actually verifies the thing it
claims to grade — memory/thread safety via valgrind and sanitizers, not
just "did stdout match" — and that differentiator carries through into
every new Path being built, not just the original C/C++ content.

## Positioning

The practice platform that actually verifies what it grades, instead of
diffing stdout — real sandboxed execution (memory safety, thread safety,
and expanding to container/git/script correctness) is the throughline,
not incidental to one content area.

## Brand Personality

Vercel / Linear / Raycast: premium, minimalist, sleek — confident and
quiet rather than loud. Confirmed and already shipped (Phase 6): strict
dark-mode default, a single violet/deep-purple brand accent kept
deliberately distinct from status colors, Geist for UI type, JetBrains
Mono for code.

## Anti-references

Not yet specified beyond what's already been avoided by design during the
Phase 6 rebrand — the "coding platform defaults to terminal-hacker
green-on-black" reflex was named and deliberately not taken, but that was
this project's own judgment call, not a user-stated anti-reference. Revisit
if there's a specific site/app to explicitly avoid resembling.

## Design Principles

- **Verify, don't just check output.** Every grading surface (existing and
  planned) should prove it actually inspected the thing it claims to
  grade, the same way the sandbox judge proves memory/thread safety rather
  than trusting a plain pass/fail.
- **Build for the audience this becomes, ship for the audience it is.**
  Data models and infra should hold up at real scale even while onboarding
  stays invite-only; don't bake in assumptions (schema, queue design,
  content) that only work for 14 people.
- **Defer public-facing complexity, not architectural correctness.**
  CAPTCHAs, automated email verification, heavy anti-cheat — real work,
  genuinely postponable until the platform actually goes public. The data
  model and job-queue design underneath them are not postponable in the
  same way.
- **The brand is general-purpose, not inside-baseball.** No content, copy,
  or UI decision should assume the reader already knows this circle's
  private context.
- **State and identity are different things.** Established in the Phase 6
  rebrand (the brand accent and the "live/success" status color are
  deliberately different colors) — keep applying that distinction as new
  UI gets built, not just where it already exists.

## Accessibility & Inclusion

No formal WCAG level has been requested. WCAG AA has been the applied
working standard so far — every color pairing introduced in the Phase 6
rebrand was verified computationally (real browser luminance math, not
eyeballed) against AA thresholds in both themes. No specific user needs or
accommodations have been specified beyond that.
