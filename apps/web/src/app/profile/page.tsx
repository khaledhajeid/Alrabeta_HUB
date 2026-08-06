export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-xl font-semibold text-text">Profile</h1>
      <div className="mt-6 rounded-lg border border-dashed border-line px-5 py-10 text-center">
        <p className="text-sm text-text-muted">
          Empty until Phase 1 wires up sign-in through Forgejo. Once that&rsquo;s live, this
          fills in with your contribution graph, streak, badges, and points.
        </p>
      </div>
    </div>
  );
}
