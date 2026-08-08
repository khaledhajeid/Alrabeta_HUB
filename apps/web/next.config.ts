import path from "node:path";
import type { NextConfig } from "next";

// Phase 7.5.G: next/image needs external hosts allowlisted explicitly.
// Derived from the same FORGEJO_URL/FORGEJO_PUBLIC_URL env vars the rest of
// the server code already reads, not hardcoded — avatar URLs come from
// whichever host Forgejo itself reports, and that differs between local dev
// (localhost) and production (the public domain).
function hostnameOf(url: string | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
const forgejoHosts = [hostnameOf(process.env.FORGEJO_URL), hostnameOf(process.env.FORGEJO_PUBLIC_URL)].filter(
  (h): h is string => Boolean(h),
);

const nextConfig: NextConfig = {
  // Better Auth's Forgejo redirect URI uses 127.0.0.1 (Forgejo's OAuth2 docs
  // warn against "localhost" for loopback redirects per RFC 8252) — the dev
  // server only trusts its own hostname by default, so without this the
  // OAuth flow's return trip 403s on every static asset and HMR socket.
  allowedDevOrigins: ["127.0.0.1"],
  // The repo root's package.json (Phase 6: husky/commitlint tooling) gives
  // Turbopack two lockfiles to choose between — this app is still the real
  // root, not the repo root.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: forgejoHosts.map((hostname) => ({
      protocol: hostname === "localhost" ? "http" : "https",
      hostname,
    })),
  },
};

export default nextConfig;
