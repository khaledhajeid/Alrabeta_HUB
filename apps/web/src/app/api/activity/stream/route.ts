import IORedis from "ioredis";
import { ACTIVITY_CHANNEL } from "@/server/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-Sent Events rather than a full WebSocket: the activity feed is
// server → client only (nothing the browser needs to send back), and SSE
// gets that for free from a plain Route Handler streaming a Response —
// no separate ws server process, no new dependency. Reach for real
// WebSockets later if something genuinely bidirectional shows up (live
// cursors, chat).
export async function GET(request: Request) {
  const subscriber = new IORedis(process.env.REDIS_URL!);
  await subscriber.subscribe(ACTIVITY_CHANNEL);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      subscriber.on("message", (_channel, message) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`));
      });

      const cleanup = () => {
        subscriber.unsubscribe(ACTIVITY_CHANNEL).catch(() => {});
        subscriber.quit().catch(() => {});
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      subscriber.quit().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
