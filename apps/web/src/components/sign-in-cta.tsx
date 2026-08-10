"use client";

import { authClient } from "@/lib/auth-client";

// The signed-out landing's primary action — same Forgejo OAuth flow
// AuthButton's nav-sized version triggers, just a larger primary-CTA
// treatment for this page's single most important click.
export function SignInCta() {
  return (
    <button
      type="button"
      onClick={() => authClient.signIn.oauth2({ providerId: "forgejo", callbackURL: "/" })}
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent-strong px-6 py-3 text-sm font-medium text-accent-ink transition-[background-color,box-shadow,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:bg-accent hover:shadow-raised active:scale-95"
    >
      Sign in with Forgejo
    </button>
  );
}
