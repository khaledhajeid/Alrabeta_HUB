import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/schema";
import { pushQueue } from "@/server/queue";

export const dynamic = "force-dynamic";

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", process.env.FORGEJO_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}

export async function POST(request: Request) {
  // HMAC must be computed over the exact raw bytes Forgejo signed —
  // read text() first, never request.json() before verifying.
  const rawBody = await request.text();

  const signature =
    request.headers.get("x-forgejo-signature") ??
    request.headers.get("x-gitea-signature");

  if (!verifySignature(rawBody, signature)) {
    return new Response("invalid signature", { status: 401 });
  }

  const event = request.headers.get("x-forgejo-event") ?? request.headers.get("x-gitea-event");
  const deliveryId =
    request.headers.get("x-forgejo-delivery") ?? request.headers.get("x-gitea-delivery");

  if (!event || !deliveryId) {
    return new Response("missing event/delivery headers", { status: 400 });
  }

  const payload = JSON.parse(rawBody);

  const [row] = await db
    .insert(webhookEvents)
    .values({ event, deliveryId, payload })
    .onConflictDoNothing({ target: webhookEvents.deliveryId })
    .returning({ id: webhookEvents.id });

  // Forgejo retries deliveries it didn't get a 200 for; onConflictDoNothing
  // means a retried delivery returns no row here — already queued, skip it.
  if (row) {
    await pushQueue.add(event, { webhookEventId: row.id, deliveryId });
  }

  return new Response("ok", { status: 200 });
}
