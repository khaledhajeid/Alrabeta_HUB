import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { userDiscordLinks, questSubmissions } from "./schema";
import { sumPassedQuestPoints } from "./points";

const API_BASE = "https://discord.com/api/v10";

async function getTotalPoints(userId: string): Promise<number> {
  const passed = await db.query.questSubmissions.findMany({
    where: and(eq(questSubmissions.userId, userId), eq(questSubmissions.status, "passed")),
    columns: { questId: true },
    with: { quest: { columns: { points: true, status: true } } },
  });
  return sumPassedQuestPoints(passed);
}

export type LinkResult = { ok: true } | { ok: false; error: "invalid_id" | "already_linked" };

// Snowflakes are 17-20 digit integers. Not cryptographically validated —
// nothing stops linking someone else's real ID (security review flagged
// this as a real confused-deputy gap, accepted for now given the bounded
// blast radius; see the comment on userDiscordLinks in schema.ts). The
// column's own unique constraint is the one concrete mitigation shipped:
// it can't be silently taken over by a second Hub account once linked.
const SNOWFLAKE_RE = /^\d{17,20}$/;

// Postgres unique_violation. Drizzle wraps the underlying postgres-js error
// (which carries `.code`) in a DrizzleQueryError as `.cause`, so both the
// error itself and its cause need checking — confirmed against a real
// constraint violation, not assumed from docs.
const PG_UNIQUE_VIOLATION = "23505";

function hasPgCode(err: unknown, code: string): boolean {
  if (!err || typeof err !== "object") return false;
  if ("code" in err && err.code === code) return true;
  return "cause" in err && hasPgCode(err.cause, code);
}

export async function linkDiscordAccount(userId: string, discordUserId: string): Promise<LinkResult> {
  if (!SNOWFLAKE_RE.test(discordUserId)) return { ok: false, error: "invalid_id" };

  try {
    await db
      .insert(userDiscordLinks)
      .values({ userId, discordUserId })
      .onConflictDoUpdate({
        target: userDiscordLinks.userId,
        set: { discordUserId, linkedAt: new Date() },
      });
  } catch (err) {
    // onConflictDoUpdate only covers a conflict on userId (re-linking your
    // own row); a conflict on the discordUserId unique constraint means
    // some other user already claimed this ID, and falls through to here
    // as a plain insert failure instead.
    if (hasPgCode(err, PG_UNIQUE_VIOLATION)) {
      return { ok: false, error: "already_linked" };
    }
    throw err;
  }

  // Best-effort, awaited so a fresh link reflects current standing right
  // away rather than waiting for the next pass — syncDiscordRole never
  // throws, so this can't fail the request that just wrote the link.
  await syncDiscordRole(userId);

  return { ok: true };
}

// Deliberately doesn't touch any already-assigned Discord role — same
// "already-earned isn't clawed back" posture as credits.ts. Unlinking just
// stops future syncs from this user's passes.
export async function unlinkDiscordAccount(userId: string): Promise<void> {
  await db.delete(userDiscordLinks).where(eq(userDiscordLinks.userId, userId));
}

export async function getDiscordLink(userId: string): Promise<string | null> {
  const row = await db.query.userDiscordLinks.findFirst({ where: eq(userDiscordLinks.userId, userId) });
  return row?.discordUserId ?? null;
}

// Best-effort, never throws: a Discord outage, an unconfigured bot, or a
// member who's left the server must not fail the grading job (or the link
// request) that triggered this. Silently no-ops when unconfigured, same
// posture as notifyDiscord in discord.ts.
export async function syncDiscordRole(userId: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) return;

  const link = await db.query.userDiscordLinks.findFirst({ where: eq(userDiscordLinks.userId, userId) });
  if (!link) return;

  const tiers = await db.query.discordRoleTiers.findMany({
    orderBy: (t, { desc }) => [desc(t.threshold)],
  });
  if (tiers.length === 0) return;

  try {
    // Independent of each other (one's a DB read, the other a Discord
    // call keyed on the link row already in hand) — run concurrently
    // rather than paying the sum of both round-trips on every passed
    // submission.
    const [points, memberRes] = await Promise.all([
      getTotalPoints(userId),
      fetch(`${API_BASE}/guilds/${guildId}/members/${link.discordUserId}`, {
        headers: { Authorization: `Bot ${token}` },
      }),
    ]);
    const targetTier = tiers.find((t) => points >= t.threshold) ?? null;
    const tierRoleIds = new Set(tiers.map((t) => t.discordRoleId));

    if (memberRes.status === 404) {
      console.warn(`[discord-roles] user ${userId} isn't a member of the configured guild, skipping`);
      return;
    }
    if (!memberRes.ok) {
      console.warn(`[discord-roles] failed to fetch member: ${memberRes.status}`);
      return;
    }
    const member = (await memberRes.json()) as { roles?: string[] };
    const currentRoles = member.roles ?? [];

    const toRemove = currentRoles.filter(
      (roleId) => tierRoleIds.has(roleId) && roleId !== targetTier?.discordRoleId,
    );
    const needsAdd = targetTier !== null && !currentRoles.includes(targetTier.discordRoleId);

    if (toRemove.length === 0 && !needsAdd) {
      console.log(`[discord-roles] ${userId} already at ${targetTier?.label ?? "no tier"}, nothing to do`);
      return;
    }

    // Each write is checked individually — a 403 here (most likely cause:
    // the bot's own role sits below the tier role, see .env.example) must
    // not be mistaken for a successful sync just because the request
    // didn't throw.
    const writes = await Promise.all([
      ...toRemove.map((roleId) =>
        fetch(`${API_BASE}/guilds/${guildId}/members/${link.discordUserId}/roles/${roleId}`, {
          method: "DELETE",
          headers: { Authorization: `Bot ${token}` },
        }).then((res) => ({ action: `remove ${roleId}`, ok: res.ok, status: res.status })),
      ),
      needsAdd
        ? fetch(
            `${API_BASE}/guilds/${guildId}/members/${link.discordUserId}/roles/${targetTier.discordRoleId}`,
            { method: "PUT", headers: { Authorization: `Bot ${token}` } },
          ).then((res) => ({ action: `add ${targetTier.discordRoleId}`, ok: res.ok, status: res.status }))
        : null,
    ]);

    const failures = writes.filter((w): w is NonNullable<typeof w> => w !== null && !w.ok);
    if (failures.length > 0) {
      console.warn(
        `[discord-roles] role sync partially failed for ${userId}:`,
        failures.map((f) => `${f.action} -> ${f.status}`).join(", "),
      );
      return;
    }

    console.log(`[discord-roles] synced ${userId} -> ${targetTier?.label ?? "no tier"}`);
  } catch (err) {
    console.warn("[discord-roles] failed to sync:", err instanceof Error ? err.message : err);
  }
}
