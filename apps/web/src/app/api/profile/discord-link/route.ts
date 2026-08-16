import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { linkDiscordAccount, unlinkDiscordAccount } from "@/server/discord-roles";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const discordUserId = typeof body?.discordUserId === "string" ? body.discordUserId.trim() : null;
  if (!discordUserId) {
    return new Response("discordUserId required", { status: 400 });
  }

  const result = await linkDiscordAccount(session.user.id, discordUserId);
  if (!result.ok) {
    const status = result.error === "already_linked" ? 409 : 400;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ ok: true });
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("unauthorized", { status: 401 });
  }

  await unlinkDiscordAccount(session.user.id);
  return Response.json({ ok: true });
}
