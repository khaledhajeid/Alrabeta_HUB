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
        className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
      >
        Sign in with Forgejo
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Forgejo avatar, not worth an image-optimization round trip
        <img src={user.image} alt="" className="h-6 w-6 rounded-full" />
      ) : (
        <div className="h-6 w-6 rounded-full bg-surface-2" aria-hidden />
      )}
      <span className="text-sm text-text">{user.name}</span>
      <button
        type="button"
        onClick={async () => {
          await authClient.signOut();
          router.refresh();
        }}
        className="text-sm text-text-muted transition-colors hover:text-text"
      >
        Sign out
      </button>
    </div>
  );
}
