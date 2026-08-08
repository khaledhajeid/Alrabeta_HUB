import { headers } from "next/headers";
import { auth } from "@/server/auth";

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-xl font-semibold text-text">Profile</h1>
        <div className="mt-6 rounded-lg border border-dashed border-line px-5 py-10 text-center">
          <p className="text-sm text-text-muted">
            Sign in with Forgejo (top right) to see this.
          </p>
        </div>
      </div>
    );
  }

  const { user } = session;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-xl font-semibold text-text">Profile</h1>

      <div className="mt-6 flex items-center gap-4 rounded-lg bg-surface p-5 shadow-resting">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Forgejo avatar
          <img src={user.image} alt="" className="h-14 w-14 rounded-full" />
        ) : (
          <div className="h-14 w-14 rounded-full bg-surface-2" aria-hidden />
        )}
        <div>
          <div className="text-base font-medium text-text">{user.name}</div>
          <div className="text-sm text-text-muted">{user.email}</div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-line px-5 py-10 text-center">
        <p className="text-sm text-text-muted">
          Contribution graph, streak, badges, and points fill in once quests
          and gamification land.
        </p>
      </div>
    </div>
  );
}
