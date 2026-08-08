import path from "node:path";
import type { NextConfig } from "next";

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
};

export default nextConfig;
