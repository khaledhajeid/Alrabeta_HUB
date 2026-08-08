# Alrabeta Hub — Design System

Companion to `docs/MASTER_PLAN.md` §2/§6. Documents the token system and
usage rules that shipped in the Phase 6 rebrand — read this before adding
any new UI, not just when touching `globals.css` directly.

## Register

Vercel / Linear / Raycast: premium, minimalist, dark-default. Not the
"terminal-hacker green-on-black" reflex that "coding platform" pattern-
matches to by default — that trap was named and deliberately avoided.

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
| `--line` | `#29262f` | `#e2dfe8` | Borders |
| `--text` | `#f5f4f8` | `#17151d` | Primary text |
| `--text-muted` | `#a19cad` | `#635d6e` | Secondary text |
| `--accent` | `#a78bfa` | `#7c3aed` | Brand accent — text/links/icons/tag highlight |
| `--accent-strong` | `#7c3aed` | `#6d28d9` | Solid fills (primary buttons) |
| `--accent-ink` | `#ffffff` | `#ffffff` | Text on `--accent-strong` |
| `--signal` | `#34d399` | `#059669` | Status: live/success — **not** brand, kept distinct on purpose |
| `--danger` | `#f87171` | `#dc2626` | Status: error |
| `--ember` | `#fb923c` | `#ea580c` | Reserved (streaks/warnings — not yet used) |

**Why `--accent` and `--signal` stay separate**: `--accent` (violet) is the
whole platform's identity — it grew out of the Violet-tier badge signal and
now carries the brand everywhere (buttons, links, the `systems` tag
highlight, focus rings, selection). `--signal` (green) is *state* — a
service-up dot, the live activity-feed indicator. Merging them would make
"this is the brand" and "this submission passed" read as the same visual
event, which they aren't.

**Contrast, computed** (browser luminance math via Playwright, not
eyeballed — see Phase 6 verification): every pairing above clears WCAG AA
(4.5:1 body text / 3:1 large text or non-text UI) in both themes. Dark
mode, the actual default experience, clears by wide margins (text 18:1,
muted text 7.4:1, accent 7.2:1, button text on `--accent-strong` 5.7:1).

## Typography

- **Sans (UI)**: Geist, self-hosted via the `geist` npm package
  (`geist/font/sans`, remapped to `--font-sans` in `globals.css`) —
  Vercel's own typeface, chosen specifically to match the named
  Vercel/Linear/Raycast reference over a more generic choice like Inter.
- **Mono (code)**: JetBrains Mono, self-hosted (`src/fonts/index.ts`,
  `--font-mono`) — unchanged from before this rebrand, already correct.
- Both fonts are self-hosted (no external font CDN calls at runtime),
  matching this project's existing no-external-dependency posture.

## Logo

`src/components/logo.tsx` exports `Logo` (full text+icon lockup) and
`LogoIcon` (icon-only mark), both using `fill="currentColor"` so they track
the active theme via the wrapping element's text color — pair with a color
utility class (e.g. `text-text`) at the call site rather than a fill prop.

- **`LogoIcon`**: mobile nav (`< sm`), compact contexts.
- **`Logo`**: desktop nav (`sm:` and up).
- **Favicon** (`src/app/icon.svg`): a separate, fixed-color copy of the
  icon mark (`#7c3aed`, violet-600) — browser chrome isn't in the page's
  theme context, so the favicon can't adapt and needs a committed color
  rather than `currentColor`.

## Layout & interaction

Unchanged from before this rebrand except where noted above — this phase
was a re-skin (color/type/logo) applied across existing surfaces, not a
layout rework. Existing conventions stay in force: 44×44px minimum touch
targets, `overflow-x: auto` on wide content, semantic z-index scale where
used, `text-wrap: balance`/`pretty` on headings/prose.
