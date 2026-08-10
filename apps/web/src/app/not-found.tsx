import Link from "next/link";

// Phase 8.5: every notFound() call (a bad quest/track/path slug) used to
// fall through to Next's generic default 404 — a jarring drop out of the
// register every other screen commits to. Matches error.tsx's shape on
// purpose: same quiet, centered, single-CTA treatment, no giant "404"
// gradient number.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 text-center">
      <h1 className="text-xl font-semibold text-text">Page not found</h1>
      <p className="mt-2 text-sm text-text-muted">
        That link doesn&rsquo;t point anywhere, or whatever it named isn&rsquo;t published.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-accent-ink transition-[background-color,box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:bg-accent hover:shadow-raised active:scale-95"
      >
        Back home
      </Link>
    </div>
  );
}
