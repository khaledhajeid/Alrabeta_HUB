import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
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
    <header className="relative border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 font-mono text-sm font-bold tracking-tight text-text"
        >
          alrabeta<span className="text-signal">.</span>hub
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
