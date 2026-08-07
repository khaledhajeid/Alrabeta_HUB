import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { db } from "./db";

type ForgejoProfile = {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  picture?: string;
};

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),
  // Identity lives in Forgejo — no local passwords to manage or leak.
  emailAndPassword: { enabled: false },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "forgejo",
          clientId: process.env.FORGEJO_OAUTH_CLIENT_ID!,
          clientSecret: process.env.FORGEJO_OAUTH_CLIENT_SECRET!,
          // The browser has to reach this one directly, so it needs whatever
          // URL is actually public — falls back to FORGEJO_URL for a pure
          // local setup with no tunnel. Token exchange and userinfo are
          // server-to-server, from this process to Forgejo, so they stay on
          // the internal URL rather than round-tripping through the tunnel.
          authorizationUrl: `${process.env.FORGEJO_PUBLIC_URL || process.env.FORGEJO_URL}/login/oauth/authorize`,
          tokenUrl: `${process.env.FORGEJO_URL}/login/oauth/access_token`,
          userInfoUrl: `${process.env.FORGEJO_URL}/login/oauth/userinfo`,
          scopes: ["openid", "profile", "email"],
          mapProfileToUser: (raw: Record<string, unknown>) => {
            const profile = raw as ForgejoProfile;
            return {
              // `name` is commonly blank until someone sets a full name in
              // Forgejo — preferred_username is always present.
              name: profile.name || profile.preferred_username || profile.sub,
              email: profile.email,
              image: profile.picture,
              emailVerified: Boolean(profile.email),
            };
          },
        },
      ],
    }),
  ],
});
