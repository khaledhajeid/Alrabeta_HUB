"use client";

import Link from "next/link";
import { useState } from "react";

export function MobileMenu({ links }: { links: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-md text-text-muted transition-colors hover:text-text"
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {open && (
        // z-20: above ordinary page content, nothing else in this app
        // competes for stacking yet (no modals/toasts/tooltips).
        <div className="absolute inset-x-0 top-full z-20 border-b border-line bg-surface px-4 py-3 shadow-lg">
          <nav className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-3 text-base text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
