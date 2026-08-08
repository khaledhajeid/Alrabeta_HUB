"use client";

// Phase 7.5.G: no error.tsx existed anywhere in app/ — a crash used to
// fall through to Next's generic, unstyled default. Deliberately doesn't
// echo error.message: this is a server-component error boundary, and a
// raw thrown message could carry query/internal details that shouldn't
// reach the browser, even on an early-stage beta product.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 text-center">
      <h1 className="text-xl font-semibold text-text">Something went wrong</h1>
      <p className="mt-2 text-sm text-text-muted">
        An unexpected error occurred. Try again, or come back in a bit.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-accent-ink transition-[background-color,box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:bg-accent hover:shadow-raised active:scale-95"
      >
        Try again
      </button>
    </div>
  );
}
