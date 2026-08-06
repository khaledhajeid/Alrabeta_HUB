import type { ActivityEvent } from "./activity";

// Signal green — "this is live," the same semantic it carries in the Hub's
// own UI. Deliberately not violet: that color is already spoken for as the
// Violet-tier badge signal (systems-quest, zero sanitizer findings, first
// try) — repurposing it here for an ordinary push would dilute the one
// thing it's supposed to mean once badges exist.
const EMBED_COLOR = 0x3fffa0;

function hubUrl(path: string) {
  return `${process.env.BETTER_AUTH_URL}${path}`;
}

// Best-effort, never throws: a Discord outage or rate limit must not fail
// the ingestion job it's reporting on, and must not retry into a duplicate
// post. Silently no-ops when unconfigured so local dev without a webhook
// set stays quiet instead of erroring.
export async function notifyDiscord(event: ActivityEvent) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            author: { name: `▲ ${event.pusher}` },
            title: event.repo,
            url: hubUrl(`/repos/${event.repo}`),
            description: event.headMessage?.split("\n")[0] || "_(no commit message)_",
            color: EMBED_COLOR,
            fields: [
              { name: "Branch", value: `\`${event.branch}\``, inline: true },
              {
                name: "Commits",
                value: `${event.commitCount}`,
                inline: true,
              },
            ],
            footer: { text: "alrabeta.hub" },
            timestamp: event.at,
          },
        ],
      }),
    });

    if (res.status === 429) {
      console.warn("[discord] rate limited, dropping this notification");
      return;
    }
    if (!res.ok) {
      console.warn(`[discord] webhook returned ${res.status}`);
      return;
    }
    console.log(`[discord] notified ${event.repo}@${event.branch}`);
  } catch (err) {
    console.warn("[discord] failed to notify:", err instanceof Error ? err.message : err);
  }
}
