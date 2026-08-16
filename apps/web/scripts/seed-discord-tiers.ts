// Idempotent, upserts on threshold like seed-shop-items.ts. No admin panel
// yet — this is the authoring path for point-threshold Discord roles: create
// the roles in your Discord server first (Server Settings -> Roles), copy
// each role's ID (enable Developer Mode, right-click the role -> Copy Role
// ID), fill in the array below, then re-run.
//
// Also make sure the bot's own role sits ABOVE every tier role listed here
// in the Roles list — Discord silently refuses to assign a role positioned
// above the bot's own, and the sync will just log a warning and no-op.
//
// Run via `npm run db:seed-discord-tiers` — that script passes
// --env-file=.env.local itself.
import { db } from "../src/server/db";
import { discordRoleTiers } from "../src/server/schema";

async function main() {
  const tiers: { threshold: number; discordRoleId: string; label: string }[] = [
    // { threshold: 50, discordRoleId: "REPLACE_WITH_REAL_ROLE_ID", label: "Bronze" },
    // { threshold: 150, discordRoleId: "REPLACE_WITH_REAL_ROLE_ID", label: "Silver" },
    // { threshold: 300, discordRoleId: "REPLACE_WITH_REAL_ROLE_ID", label: "Gold" },
  ];

  if (tiers.length === 0) {
    console.log("no tiers defined yet — edit the array in this script with real thresholds/role IDs");
    process.exit(0);
  }

  for (const t of tiers) {
    await db
      .insert(discordRoleTiers)
      .values(t)
      .onConflictDoUpdate({
        target: discordRoleTiers.threshold,
        set: { discordRoleId: t.discordRoleId, label: t.label },
      });
    console.log(`seeded: ${t.label} (${t.threshold}+)`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
