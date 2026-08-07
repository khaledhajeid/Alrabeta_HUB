import { checkHealth } from "@/server/health";
import { getRecentActivity } from "@/server/activity";
import { ActivityFeed } from "@/components/activity-feed";

// Health checks hit FORGEJO_URL (internal, reliable); anything a beta user
// might actually click needs the URL their own browser can reach.
const FORGEJO_LINK_URL = process.env.FORGEJO_PUBLIC_URL || process.env.FORGEJO_URL;

const SERVICES = [
  { key: "forgejo", label: "Forgejo", detail: FORGEJO_LINK_URL, href: FORGEJO_LINK_URL },
  { key: "postgres", label: "Postgres", detail: "alrabeta", href: undefined },
  { key: "redis", label: "Redis", detail: "push-events queue", href: undefined },
] as const;

export default async function HomePage() {
  const [status, activity] = await Promise.all([checkHealth(), getRecentActivity()]);
  const allUp = Object.values(status).every(Boolean);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text">Activity</h1>
        <p className="mt-1 text-sm text-text-muted">
          Live the moment anyone pushes — this updates without a refresh.
        </p>
      </div>

      <ActivityFeed initial={activity} />

      <div className="mt-10 flex items-center justify-between border-t border-line pt-4">
        <div className="flex items-center gap-4">
          {SERVICES.map((service) => (
            <div key={service.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${status[service.key] ? "bg-signal" : "bg-danger"}`}
              />
              <span className="font-mono text-xs text-text-muted">{service.label}</span>
            </div>
          ))}
        </div>
        {status.forgejo && (
          <a
            href={FORGEJO_LINK_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-text-muted underline decoration-line underline-offset-2 hover:text-text"
          >
            Open Forgejo ↗
          </a>
        )}
      </div>

      {!allUp && (
        <p className="mt-2 text-sm text-text-muted">
          Something&rsquo;s not reachable. Run{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
            docker compose up -d
          </code>{" "}
          in <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">infra/</code>{" "}
          and refresh.
        </p>
      )}
    </div>
  );
}
