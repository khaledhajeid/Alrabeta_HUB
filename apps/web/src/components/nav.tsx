import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { ThemeToggle } from "./theme-toggle";
import { AuthButton } from "./auth-button";

export async function Nav() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 font-mono text-sm font-bold tracking-tight text-text"
        >
          alrabeta<span className="text-signal">.</span>hub
        </Link>
        <nav className="flex items-center gap-1 sm:gap-4">
          <Link
            href="/repos"
            className="rounded-md px-2 py-1.5 text-sm text-text-muted transition-colors hover:text-text sm:px-0 sm:py-0"
          >
            Repos
          </Link>
          <Link
            href="/profile"
            className="rounded-md px-2 py-1.5 text-sm text-text-muted transition-colors hover:text-text sm:px-0 sm:py-0"
          >
            Profile
          </Link>
          <AuthButton user={session?.user ?? null} />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
