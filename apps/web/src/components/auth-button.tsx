"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type SessionUser = {
  name: string;
  image?: string | null;
} | null;

export function AuthButton({ user }: { user: SessionUser }) {
  const router = useRouter();

  if (!user) {
    return (
      <button
        type="button"
        onClick={() =>
          authClient.signIn.oauth2({ providerId: "forgejo", callbackURL: "/" })
        }
        className="whitespace-nowrap rounded-md border border-line px-2.5 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2 sm:px-3 sm:py-1.5"
      >
        <span className="sm:hidden">Sign in</span>
        <span className="hidden sm:inline">Sign in with Forgejo</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Forgejo avatar, not worth an image-optimization round trip
        <img src={user.image} alt="" className="h-6 w-6 shrink-0 rounded-full" />
      ) : (
        <div className="h-6 w-6 shrink-0 rounded-full bg-surface-2" aria-hidden />
      )}
      <span className="hidden text-sm text-text sm:inline">{user.name}</span>
      <button
        type="button"
        aria-label="Sign out"
        onClick={async () => {
          await authClient.signOut();
          router.refresh();
        }}
        className="flex h-11 w-11 items-center justify-center rounded-md text-text-muted transition-colors hover:text-text sm:h-auto sm:w-auto sm:text-sm sm:hover:bg-transparent"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="sm:hidden"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}
