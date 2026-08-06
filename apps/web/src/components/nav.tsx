import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function Nav() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="font-mono text-sm font-bold tracking-tight text-text">
          alrabeta<span className="text-signal">.</span>hub
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/profile"
            className="text-sm text-text-muted transition-colors hover:text-text"
          >
            Profile
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
