# Alrabeta Hub — Design System

Companion to `docs/MASTER_PLAN.md` §2/§2.5/§9. Documents the token system
and usage rules that shipped in the Phase 6 rebrand and the Phase 7.5
redesign (motion, elevation, type hierarchy, gamification visibility) —
read this before adding any new UI, not just when touching `globals.css`
directly.

## Register

Vercel / Linear / Raycast: premium, minimalist, dark-default. Not the
"terminal-hacker green-on-black" reflex that "coding platform" pattern-
matches to by default — that trap was named and deliberately avoided.
Motion and depth follow the same restraint: quiet and confident, not
game-arcade. See `docs/PRODUCT.md`'s design principles for the fuller
statement of intent this system implements.

## Color

Strict dark default — the bare `:root` in `globals.css` *is* the dark
palette, not gated behind `prefers-color-scheme`. `theme-script.tsx` sets
`data-theme="dark"` before paint even with no stored choice; the only way
to get light is an explicit toggle, which persists to `localStorage`.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--ink` | `#0b0a10` | `#faf9fc` | Page background |
| `--surface` | `#131218` | `#ffffff` | Nav, cards |
| `--surface-2` | `#1b1a22` | `#f2f0f6` | Hover/elevated state |
| `--line` | `#29262f` | `#e2dfe8` | Borders, dividers, elevation ring |
| `--text` | `#f5f4f8` | `#17151d` | Primary text |
| `--text-muted` | `#a19cad` | `#635d6e` | Secondary text |
| `--accent` | `#a78bfa` | `#7c3aed` | Brand accent — text/links/icons/tag highlight/badges |
| `--accent-strong` | `#7c3aed` | `#6d28d9` | Solid fills (primary buttons) |
| `--accent-ink` | `#ffffff` | `#ffffff` | Text on `--accent-strong` |
| `--signal` | `#34d399` | `#047857` | Status: live/success/passed — **not** brand, kept distinct on purpose |
| `--danger` | `#f87171` | `#dc2626` | Status: error/failed |
| `--ember` | `#fb923c` | `#c2410c` | Syntax-highlight accent (strings/attrs); reserved for streaks/warnings elsewhere |

**Why `--accent` and `--signal` (and `--danger`) stay separate**: `--accent`
(violet) is the whole platform's identity — it grew out of the Violet-tier
badge signal and now carries the brand everywhere (buttons, links, the
`systems` tag highlight, focus rings, selection, `BadgePill`). `--signal`
(green) and `--danger` (red) are *state* — a service-up dot, the live
activity-feed indicator, a submission's `Passed`/`Failed` result in
`SubmissionStatus`. Merging brand and state would make "this is the brand"
and "this submission passed" read as the same visual event, which they
aren't — this distinction now spans both the original status dots and the
Phase 7.5.F gamification surfaces.

**Contrast, computed** (real browser luminance math — canvas-normalized so
OKLCH/oklab values resolve correctly, not eyeballed): every pairing above
clears WCAG AA (4.5:1 body text / 3:1 large text or non-text UI) in both
themes.
- Dark mode (the default): text 18:1, muted text 7.4:1, accent 7.2:1,
  button text on `--accent-strong` 5.7:1.
- `--ember` on the quest-prose code-block background: dark 8.71:1, light
  4.94:1 — the light value was a real, shipped AA failure (3.39:1) until
  Phase 7.5.G; fixed by moving from orange-600 to orange-700, not by
  loosening the standard.
- `--signal` on the same background: dark 9.69:1, light 5.23:1 — the light
  value was *also* a real AA failure (3.59–3.77:1 depending on background)
  until the Phase 7.5.H closing re-audit caught it, on the very
  `SubmissionStatus` "Passed" text this phase built; fixed the same way as
  `--ember`, one step darker (emerald-600 → emerald-700).
- `BadgePill` (`text-accent` on `bg-accent/10`): dark 6.44:1, light 4.68:1
  — light clears AA with a real but not generous margin, noted honestly
  rather than rounded up.

## Elevation (Phase 7.5.A/D)

Two tokens, both theme-aware and violet-tinted rather than generic black —
depth reads as *this brand's* depth, following Vercel's shadow-as-border
research (a hairline ring plus a soft ambient lift, not a heavy drop
shadow).

| Token | Use |
|---|---|
| `--shadow-resting` | Default raised surface: nav, list-container cards, profile/quest-detail cards, the quest-catalog and repo-directory card grids |
| `--shadow-raised` | Hover/overlay state: card hover (`hover:shadow-raised` alongside a slight `-translate-y-0.5`), the mobile-menu dropdown, the primary CTA's hover state |

Mapped into Tailwind as real utilities (`shadow-resting`, `shadow-raised`)
via `@theme inline`, referencing the same runtime custom properties the
color tokens use — so they flip with the theme automatically.

**What still uses a plain `border` on purpose**: genuinely tabular/dense
content keeps its divider borders rather than getting promoted to
elevation — the commit list, `divide-y` row dividers inside any list
container, markdown tables, dashed empty-state placeholders. Elevation is
for surfaces that read as *raised*; borders are for structure. Conflating
the two was a real, named failure mode this phase corrected, not a rule to
apply everywhere reflexively.

## Motion (Phase 7.5.A/C)

| Token | Value |
|---|---|
| `--motion-fast` | 120ms — hover/press feedback |
| `--motion-base` | 180ms — most transitions, list-item reveal |
| `--motion-slow` | 280ms — stagger spread ceiling |
| `--ease-out-quint` | `cubic-bezier(0.22, 1, 0.36, 1)` — the one curve this project uses for anything that isn't an instant state flip. No bounce, no elastic |

**Where motion is used**:
- Hover/press micro-interactions on every interactive row, button, and tag
  pill (`transform`/`box-shadow`/`background-color` transitions only —
  never layout properties).
- Route transitions via React's built-in `<ViewTransition>`
  (`route-transition.tsx`, wired into `layout.tsx`), keyed on the current
  pathname. A plain crossfade, deliberately not a directional slide — this
  is a flat-nav product surface, not a gallery drill-down, and the product
  register is explicit that motion here should read as "the route
  changed," not stage a page-load moment. The nav is anchored via
  `viewTransitionName: "site-header"` so it never appears to move or
  refade across a navigation.
- `.reveal-list`: a capped stagger-reveal (first 8 rows, `nth-child`
  delays, pure CSS) on the activity feed, quest catalog, repo directory,
  commit history, and the quest-detail submissions list. One deliberate
  reveal per list, not a uniform reflex applied everywhere.

**Reduced motion**: a global `@media (prefers-reduced-motion: reduce)`
rule collapses every `animation`/`transition` duration to near-zero.
`::view-transition-*` pseudo-elements need their own coverage in the same
media query — they're not real DOM nodes, so the universal-selector rule
can't reach them (this is called out explicitly in React's own
view-transitions guide, not something we discovered independently, but
worth restating since it's an easy gap to reintroduce).

## Z-index (Phase 7.5.A)

A real semantic scale, replacing what used to be one hardcoded `z-20`:
`--z-dropdown` (20) → `--z-sticky` (30) → `--z-modal-backdrop` (40) →
`--z-modal` (50) → `--z-toast` (60) → `--z-tooltip` (70). Referenced via
Tailwind's CSS-variable syntax, e.g. `z-(--z-dropdown)`. Extend this scale
rather than reaching for an arbitrary number when a new layer is needed.

## Typography

- **Sans (UI)**: Geist, self-hosted via the `geist` npm package
  (`geist/font/sans`, remapped to `--font-sans` in `globals.css`) —
  Vercel's own typeface, chosen specifically to match the named
  Vercel/Linear/Raycast reference over a more generic choice like Inter.
- **Mono (code)**: JetBrains Mono, self-hosted (`src/fonts/index.ts`,
  `--font-mono`).
- Both fonts are self-hosted (no external font CDN calls at runtime).

**Type scale (Phase 7.5.E)**: no new tokens — Tailwind's own default scale
already fits a product register's tight-ratio guidance (1.11–1.14 between
adjacent steps from `sm`→`base`→`lg`). The Phase 6-era problem wasn't a
missing scale, it was inconsistent *use*: card/row titles had no explicit
size class and metadata used one-off arbitrary values. The fix, applied
across quest cards, repo cards, and the commit list:

| Role | Class | Size |
|---|---|---|
| Page heading | `text-xl font-semibold` | 20px |
| Card/row title | `text-base font-semibold` (or `font-medium` where the row stays dense/tabular, e.g. commit messages) | 16px |
| Body/summary | `text-sm` | 14px |
| Metadata (tags, difficulty, timestamps, points) | `text-xs` | 12px |

## Logo

`src/components/logo.tsx` exports two independently sized pieces, composed
via flexbox at the call site (`nav.tsx`) rather than as one fused SVG:

- **`LogoIcon`**: the icon mark alone, `viewBox="0 0 1200 1200"`.
- **`Wordmark`** (Phase 7.5.B, replacing the old stacked `Logo` component):
  the wordmark paths only, cropped to their own tight viewBox
  (`0 4.9 182.5 15.2`). The old `Logo` component stacked icon-above-
  wordmark into a single 24px-tall box, which made the wordmark
  functionally illegible (~6–8px cap-height) — composing two independently
  sized pieces with CSS instead of one multi-transform SVG is what fixed
  it, and is more robust across breakpoints than hand-computing a combined
  transform matrix.

Both use `fill="currentColor"` so they track the active theme via the
wrapping element's text color — pair with a color utility class (e.g.
`text-text`) at the call site rather than a fill prop.

- Nav (`nav.tsx`): `LogoIcon` (28px) + `Wordmark` (14px height on mobile,
  16px from `sm:` up) shown together at every breakpoint — the wordmark
  used to disappear entirely below 640px. The link carries a 44px-tall hit
  area (`py-2` around the icon, `-ml-2` cancels the matching visual
  inset) per this project's own touch-target convention.
- **Favicon** (`src/app/icon.svg`): a separate, fixed-color copy of the
  icon mark (`#7c3aed`, violet-600) — browser chrome isn't in the page's
  theme context, so the favicon can't adapt and needs a committed color
  rather than `currentColor`.

## Layout patterns (Phase 7.5.E)

Three distinct shapes for three distinct content types, replacing the one
`divide-y` bordered-row-list template every list on this site used to
share regardless of what it actually held:

- **Browsable catalog** (quest catalog, repo directory): a card grid,
  `grid-cols-[repeat(auto-fill,minmax(260px,1fr))]`, each card
  `shadow-resting` with `hover:shadow-raised` + a slight `-translate-y-0.5`
  lift. Card *shape* differs per entity (points+tags for a quest,
  private-badge+branch for a repo) — same idea, not the same template
  copy-pasted.
- **Live sequence** (activity feed): a real timeline — a connecting line
  between dot nodes, sitting directly on the page canvas rather than
  inside a bordered box, since the line does the grouping work a border
  used to.
- **Genuinely tabular/dense** (commit list, the quest-detail submissions
  list, markdown tables): stays a `divide-y` row list. This shape is
  correct for this content — the fix was not applying it to everything
  else by default.

## Gamification components (Phase 7.5.F)

- **`SubmissionStatus`** (`components/submission-status.tsx`): icon +
  `--signal`/`--danger` color + `font-semibold`, replacing what used to be
  a plain-text status label indistinguishable in weight from a timestamp.
  Status is state, so it deliberately does not use `--accent`.
- **`BadgePill`** (`components/badge-pill.tsx`): a spark icon on a
  violet/`--accent` tinted pill — matches the existing `systems`-tag
  treatment rather than inventing a new visual language. Surfaced on the
  profile page (real query against the `badges` table) and quest detail
  (badges earned per submission, plus a "solve this clean to earn X" hint
  shown *before* the quest is ever solved). Display metadata lives in
  `lib/badge-info.ts`, deliberately separate from `server/badges.ts`'s
  grading/eligibility logic so client components don't import server-only
  types.
- Tone is deliberately quiet and confident — a spark and a checkmark, not
  a trophy or a confetti burst. The reward comes from real visual weight
  and precision, not decoration volume, matching the Vercel/Linear/Raycast
  restraint the rest of this system already commits to.

## Accessibility & robustness conventions (Phase 7.5.G)

- Color-only state (status dots, live indicators) needs a text alternative
  reachable by a screen reader — an `sr-only` span, not just `aria-hidden`
  on a colored dot. Applied to the homepage service-status row; extend the
  same pattern to any future color-only indicator.
- Any custom dropdown/menu that isn't a native element needs a focus trap
  and an `Escape` handler — see `mobile-menu.tsx` for the reference
  implementation (confine `Tab`/`Shift+Tab` to the trigger + panel,
  restore focus to the trigger on close).
- A filter/selection UI showing more than ~5–6 simultaneous options is a
  working-memory violation (Cowan's revised Miller's Law) — collapse to a
  `<select>` or combobox past that threshold rather than rendering every
  option inline. See `tag-filter-select.tsx`.
- Every route segment gets a real `loading.tsx` (skeleton blocks, not a
  spinner — product register: loading states shouldn't feel like "watching
  it load") and the app has a styled root `error.tsx` that doesn't echo
  raw error messages to the client.
- External avatar images use `next/image` (remote host allowlisted in
  `next.config.ts` via `images.remotePatterns`, derived from the same
  `FORGEJO_URL`/`FORGEJO_PUBLIC_URL` env vars the rest of the server code
  reads) with real `alt` text, not `alt=""` on a meaningful image.

## Layout & interaction — general

44×44px minimum touch targets, `overflow-x: auto` on wide content,
`text-wrap: balance`/`pretty` on headings/prose. `line-clamp-2` on card
summaries/descriptions rather than letting them run unbounded.
