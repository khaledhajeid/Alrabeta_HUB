import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { equipItem } from "@/server/shop";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  if (!itemId) {
    return new Response("itemId required", { status: 400 });
  }

  const result = await equipItem({ userId: session.user.id, itemId });
  if (!result.ok) {
    const status = result.error === "item_not_found" ? 404 : 409;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ ok: true });
}
