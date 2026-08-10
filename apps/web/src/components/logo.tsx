import type { SVGProps } from "react";

// Both marks use `currentColor` (not a baked-in fill) so they track the
// active theme via the wrapping element's text color — pair with a color
// utility class (e.g. `text-text`) at the call site, not a fill prop.

// Phase 8.5 nav/logo pass: the original mark (dozens of small decorative
// paths making up an intricate flower/orbit pattern) was drawn at a scale
// where the detail only resolves zoomed in — at the 28px nav size it
// rendered as an illegible gray smudge. Vercel's triangle, Linear's
// swirled square, Raycast's inset square: every premium reference mark is
// one confident solid shape plus one deliberate cut, not dense detail.
// This mark keeps that discipline: a single rounded square with one
// corner replaced by a straight chamfer — a "cut corner" motif (a tagged
// card/note, echoing "Hub" as a place things get filed) that reads at any
// size because it's one fill, no sub-pixel detail to lose.
export function LogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Alrabeta Hub" {...props}>
      <title>Alrabeta Hub</title>
      <path
        fill="currentColor"
        d="M9,3 L20,3 L29,12 L29,23 A6,6 0 0 1 23,29 L9,29 A6,6 0 0 1 3,23 L3,9 A6,6 0 0 1 9,3 Z"
      />
    </svg>
  );
}

// The wordmark's own glyph coordinates, cropped tight (no padding baked in
// — pair with a color utility class the same as the other marks, and give
// it room via layout, not by stretching it into a taller box like the old
// stacked lockup did). Composed next to LogoIcon via flex at the call
// site (nav.tsx) rather than as a single fused SVG — two independently
// sized elements are easier to keep legible across breakpoints than one
// multi-transform lockup.
export function Wordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 4.9 182.5 15.2" role="img" aria-label="Alrabeta Hub" {...props}>
      <title>Alrabeta Hub</title>
      <path
        fill="currentColor"
        d="M14.78 18.86 q0.14 0.32 -0.07 0.65 t-0.57 0.33 l-13.32 0 q-0.18 0 -0.34 -0.09 t-0.24 -0.23 q-0.22 -0.32 -0.06 -0.66 l0.62 -1.46 q0.08 -0.2 0.26 -0.32 t0.38 -0.12 l9.32 0 l-3.28 -7.84 l-2.68 6.4 q-0.08 0.2 -0.25 0.31 t-0.39 0.11 l-1.68 0 q-0.38 0 -0.6 -0.32 q-0.08 -0.14 -0.1 -0.32 t0.04 -0.34 l4.06 -9.52 q0.08 -0.2 0.25 -0.32 t0.39 -0.12 l1.92 0 q0.22 0 0.39 0.12 t0.25 0.32 z M20.548 5 q0.28 0 0.49 0.21 t0.21 0.49 l0 13.4 q0 0.28 -0.21 0.49 t-0.49 0.21 l-1.52 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.49 l0 -13.4 q0 -0.28 0.21 -0.49 t0.49 -0.21 l1.52 0 z M27.848 16.94 q0.3 0 0.5 0.21 t0.2 0.49 l0 1.46 q0 0.28 -0.2 0.49 t-0.5 0.21 l-4.66 0 q-0.3 0 -0.5 -0.21 t-0.2 -0.49 l0 -1.46 q0 -0.28 0.2 -0.49 t0.5 -0.21 l4.66 0 z M41.736 14.1 l3.02 4.62 q0.22 0.36 0.02 0.72 q-0.08 0.16 -0.25 0.26 t-0.35 0.1 l-1.82 0 q-0.18 0 -0.34 -0.09 t-0.24 -0.23 l-3.04 -4.82 l-3.56 0 l0 4.44 q0 0.28 -0.21 0.49 t-0.49 0.21 l-1.52 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.49 l0 -6.58 q0 -0.28 0.21 -0.49 t0.49 -0.21 l6.16 0 q1.76 0 2.34 -1 q0.2 -0.32 0.2 -0.92 q0 -0.94 -0.62 -1.48 q-0.64 -0.58 -1.84 -0.58 l-6.24 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.49 l0 -1.44 q0 -0.28 0.21 -0.49 t0.49 -0.21 l6.42 0 q2.34 0 3.74 1.32 q1.46 1.32 1.46 3.58 q0 1.46 -0.64 2.49 t-1.86 1.57 z M62.104 18.86 q0.14 0.32 -0.07 0.65 t-0.57 0.33 l-13.32 0 q-0.18 0 -0.34 -0.09 t-0.24 -0.23 q-0.22 -0.32 -0.06 -0.66 l0.62 -1.46 q0.08 -0.2 0.26 -0.32 t0.38 -0.12 l9.32 0 l-3.28 -7.84 l-2.68 6.4 q-0.08 0.2 -0.25 0.31 t-0.39 0.11 l-1.68 0 q-0.38 0 -0.6 -0.32 q-0.08 -0.14 -0.1 -0.32 t0.04 -0.34 l4.06 -9.52 q0.08 -0.2 0.25 -0.32 t0.39 -0.12 l1.92 0 q0.22 0 0.39 0.12 t0.25 0.32 z M76.212 12.18 q1.04 0.64 1.52 1.84 q0.28 0.64 0.28 1.58 q0 1.46 -0.78 2.45 t-2.28 1.47 q-0.94 0.32 -2.22 0.32 l-6.38 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.49 l0 -1.44 q0 -0.3 0.21 -0.51 t0.49 -0.21 l6.54 0 q1.16 0 1.72 -0.42 q0.48 -0.4 0.48 -1.09 t-0.5 -1.13 q-0.62 -0.54 -1.86 -0.54 l-6.38 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.51 l0 -1.38 q0 -0.28 0.21 -0.49 t0.49 -0.21 l6.02 0 q0.86 0 1.34 -0.3 q0.34 -0.2 0.54 -0.58 q0.14 -0.28 0.14 -0.65 t-0.1 -0.67 q-0.08 -0.24 -0.28 -0.44 q-0.44 -0.5 -1.46 -0.5 l-6.2 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.51 l0 -1.44 q0 -0.28 0.21 -0.49 t0.49 -0.21 l6.02 0 q2.48 0 3.82 1.4 q1.14 1.14 1.14 2.86 q0 1.84 -1.12 2.92 z M92.8 16.96 q0.3 0 0.5 0.21 t0.2 0.51 l0 1.46 q0 0.28 -0.2 0.49 t-0.5 0.21 l-9.88 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.49 l0 -1.46 q0 -0.3 0.21 -0.51 t0.49 -0.21 l9.88 0 z M82.92 13.86 q-0.28 0 -0.49 -0.21 t-0.21 -0.49 l0 -1.5 q0 -0.28 0.21 -0.49 t0.49 -0.21 l8.98 0 q0.3 0 0.51 0.21 t0.21 0.49 l0 1.5 q0 0.28 -0.21 0.49 t-0.51 0.21 l-8.98 0 z M92.8 5 q0.3 0 0.5 0.21 t0.2 0.49 l0 1.46 q0 0.3 -0.2 0.51 t-0.5 0.21 l-9.88 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.51 l0 -1.46 q0 -0.28 0.21 -0.49 t0.49 -0.21 l9.88 0 z M99.108 5 q0.3 0 0.51 0.21 t0.21 0.51 l0 1.46 q0 0.3 -0.21 0.51 t-0.51 0.21 l-2.06 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.51 l0 -1.46 q0 -0.3 0.21 -0.51 t0.49 -0.21 l2.06 0 z M108.048 5 q0.28 0 0.49 0.21 t0.21 0.51 l0 1.46 q0 0.3 -0.21 0.51 t-0.49 0.21 l-4.02 0 l0 11.36 q0 0.28 -0.21 0.49 t-0.49 0.21 l-1.54 0 q-0.3 0 -0.51 -0.21 t-0.21 -0.49 l0 -13.54 q0 -0.3 0.21 -0.51 t0.51 -0.21 l6.26 0 z M125.576 18.86 q0.14 0.32 -0.07 0.65 t-0.57 0.33 l-13.32 0 q-0.18 0 -0.34 -0.09 t-0.24 -0.23 q-0.22 -0.32 -0.06 -0.66 l0.62 -1.46 q0.08 -0.2 0.26 -0.32 t0.38 -0.12 l9.32 0 l-3.28 -7.84 l-2.68 6.4 q-0.08 0.2 -0.25 0.31 t-0.39 0.11 l-1.68 0 q-0.38 0 -0.6 -0.32 q-0.08 -0.14 -0.1 -0.32 t0.04 -0.34 l4.06 -9.52 q0.08 -0.2 0.25 -0.32 t0.39 -0.12 l1.92 0 q0.22 0 0.39 0.12 t0.25 0.32 z M135.792 10.12 q-0.28 0 -0.49 -0.21 t-0.21 -0.49 l0 -3.72 q0 -0.28 0.21 -0.49 t0.49 -0.21 l1.52 0 q0.3 0 0.5 0.21 t0.2 0.49 l0 3.72 q0 0.28 -0.2 0.49 t-0.5 0.21 l-1.52 0 z M146.652 5 q0.28 0 0.49 0.21 t0.21 0.49 l0 13.44 q0 0.28 -0.21 0.49 t-0.49 0.21 l-1.52 0 q-0.3 0 -0.5 -0.21 t-0.2 -0.49 l0 -5.28 l-6.42 0 l0 5.28 q0 0.28 -0.2 0.49 t-0.5 0.21 l-1.52 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.49 l0 -7.48 q0 -0.28 0.21 -0.49 t0.49 -0.21 l8.64 0 l0 -5.26 q0 -0.28 0.2 -0.49 t0.5 -0.21 l1.52 0 z M157.52 17.06 q0.24 0.08 0.38 0.27 t0.14 0.43 l0 1.54 q0 0.32 -0.26 0.54 q-0.2 0.16 -0.44 0.16 q-0.1 0 -0.14 -0.02 q-1.86 -0.36 -3.2 -1.72 q-1.8 -1.84 -1.8 -4.84 l0 -7.7 q0 -0.3 0.21 -0.51 t0.49 -0.21 l1.54 0 q0.3 0 0.51 0.21 t0.21 0.51 l0 7.74 q0 1.9 1.08 2.9 q0.56 0.52 1.28 0.7 z M164.42 5 q0.3 0 0.51 0.21 t0.21 0.51 l0 7.7 q0 3 -1.8 4.84 q-1.34 1.36 -3.2 1.72 q-0.04 0.02 -0.14 0.02 q-0.24 0 -0.44 -0.16 q-0.26 -0.2 -0.26 -0.56 l0 -1.54 q0 -0.22 0.14 -0.41 t0.38 -0.27 q0.76 -0.22 1.28 -0.7 q1.08 -0.96 1.08 -2.9 l0 -7.74 q0 -0.3 0.21 -0.51 t0.51 -0.21 l1.52 0 z M180.548 12.18 q1.04 0.64 1.52 1.84 q0.28 0.64 0.28 1.58 q0 1.46 -0.78 2.45 t-2.28 1.47 q-0.94 0.32 -2.22 0.32 l-6.38 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.49 l0 -1.44 q0 -0.3 0.21 -0.51 t0.49 -0.21 l6.54 0 q1.16 0 1.72 -0.42 q0.48 -0.4 0.48 -1.09 t-0.5 -1.13 q-0.62 -0.54 -1.86 -0.54 l-6.38 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.51 l0 -1.38 q0 -0.28 0.21 -0.49 t0.49 -0.21 l6.02 0 q0.86 0 1.34 -0.3 q0.34 -0.2 0.54 -0.58 q0.14 -0.28 0.14 -0.65 t-0.1 -0.67 q-0.08 -0.24 -0.28 -0.44 q-0.44 -0.5 -1.46 -0.5 l-6.2 0 q-0.28 0 -0.49 -0.21 t-0.21 -0.51 l0 -1.44 q0 -0.28 0.21 -0.49 t0.49 -0.21 l6.02 0 q2.48 0 3.82 1.4 q1.14 1.14 1.14 2.86 q0 1.84 -1.12 2.92 z"
      />
    </svg>
  );
}
