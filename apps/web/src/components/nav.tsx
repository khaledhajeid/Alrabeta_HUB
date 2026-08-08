import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { LogoIcon, Wordmark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { AuthButton } from "./auth-button";
import { MobileMenu } from "./mobile-menu";

const LINKS = [
  { href: "/quests", label: "Quests" },
  { href: "/repos", label: "Repos" },
  { href: "/profile", label: "Profile" },
];

export async function Nav() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user ?? null;

  return (
    // shadow-resting (Phase 7.5.D) replaces the flat border-b — same
    // --line-colored ring, plus a whisper of lift so the bar reads as
    // sitting above the page rather than just divided from it.
    // viewTransitionName anchors this element across route-transition.tsx's
    // navigations (see globals.css's site-header rules) — the header is the
    // one thing on screen that must never appear to move or refade.
    <header className="relative bg-surface shadow-resting" style={{ viewTransitionName: "site-header" }}>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* py-2 gives a 44px-tall hit area around the 28px icon (this
            project's own documented touch-target minimum); -ml-2 cancels a
            matching left inset so the icon still sits flush with the row's
            own padding — no right-side padding needed, the wordmark itself
            already carries the hit area well past 44px wide. Icon +
            wordmark compose here via flex rather than as one fused SVG (see
            logo.tsx) — a horizontal lockup at a legible size, instead of
            the old stacked mark that disappeared into an illegible smudge
            once squeezed into a 24px-tall box. The wordmark runs smaller
            below `sm:` — at 375px, the full 14px size overflowed the row
            once the auth button, theme toggle, and menu trigger are all
            present; measured empirically, not guessed. */}
        <Link
          href="/"
          className="-ml-2 flex shrink-0 items-center gap-1.5 rounded-md py-2 pl-2 text-text"
          aria-label="Alrabeta Hub — home"
        >
          <LogoIcon className="h-7 w-7" />
          <Wordmark className="h-2.5 w-auto sm:h-4" />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Three links comfortably fit inline on wider screens; at phone
              widths they move behind MobileMenu instead of shrinking further
              — three text links plus auth plus theme toggle simply doesn't
              fit in 375px no matter how tight the spacing gets. */}
          <nav className="hidden items-center gap-4 sm:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-text-muted transition-colors hover:text-text"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <AuthButton user={user} />
          <ThemeToggle />
          <MobileMenu links={LINKS} />
        </div>
      </div>
    </header>
  );
}
