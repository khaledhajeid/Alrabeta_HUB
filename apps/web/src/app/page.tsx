import { checkHealth } from "@/server/health";

const SERVICES = [
  { key: "forgejo", label: "Forgejo", detail: process.env.FORGEJO_URL, href: process.env.FORGEJO_URL },
  { key: "postgres", label: "Postgres", detail: "alrabeta", href: undefined },
  { key: "redis", label: "Redis", detail: "push-events queue", href: undefined },
] as const;

export default async function HomePage() {
  const status = await checkHealth();
  const allUp = Object.values(status).every(Boolean);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-text">Local environment</h1>
        <p className="mt-1 text-sm text-text-muted">
          Phase 0 infrastructure, running on this machine. Nothing here talks to a VPS.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {SERVICES.map((service, i) => {
          const up = status[service.key];
          return (
            <div
              key={service.key}
              className={`flex items-center justify-between px-5 py-4 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${up ? "bg-signal" : "bg-danger"}`}
                />
                <div>
                  <div className="text-sm font-medium text-text">{service.label}</div>
                  <div className="font-mono text-xs text-text-muted">{service.detail}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`font-mono text-xs ${up ? "text-signal" : "text-danger"}`}>
                  {up ? "online" : "unreachable"}
                </span>
                {service.href && up && (
                  <a
                    href={service.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-text-muted underline decoration-line underline-offset-2 hover:text-text"
                  >
                    Open ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!allUp && (
        <p className="mt-4 text-sm text-text-muted">
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
