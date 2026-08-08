"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResyncButton({ owner, name }: { owner: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-danger">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const res = await fetch(`/api/repos/${owner}/${name}/resync`, { method: "POST" });
            if (!res.ok) {
              setError(res.status === 401 ? "Sign in to resync" : `Failed (${res.status})`);
              return;
            }
            router.refresh();
          } catch {
            setError("Network error");
          } finally {
            setPending(false);
          }
        }}
        className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-text-muted transition-[color,background-color,transform] duration-(--motion-fast) ease-(--ease-out-quint) hover:bg-surface-2 hover:text-text active:scale-95 disabled:opacity-50 disabled:active:scale-100"
      >
        {pending ? "Resyncing…" : "Resync from Forgejo"}
      </button>
    </div>
  );
}
