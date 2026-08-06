"use client";

import { useEffect, useState } from "react";
import type { ActivityEvent } from "@/server/activity";

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Row({ event, isLive }: { event: ActivityEvent; isLive?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <span
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isLive ? "bg-signal" : "bg-line"}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-text">
          <span className="font-medium">{event.pusher}</span> pushed{" "}
          {event.commitCount} {event.commitCount === 1 ? "commit" : "commits"} to{" "}
          <span className="font-mono text-text-muted">
            {event.repo}@{event.branch}
          </span>
        </div>
        {event.headMessage && (
          <div className="mt-0.5 truncate font-mono text-xs text-text-muted">
            {event.headMessage.split("\n")[0]}
          </div>
        )}
      </div>
      <span className="shrink-0 font-mono text-xs text-text-muted">{timeAgo(event.at)}</span>
    </div>
  );
}

export function ActivityFeed({ initial }: { initial: ActivityEvent[] }) {
  const [events, setEvents] = useState(initial);
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const source = new EventSource("/api/activity/stream");
    source.onmessage = (message) => {
      const event: ActivityEvent = JSON.parse(message.data);
      setEvents((prev) => [event, ...prev].slice(0, 30));
      setLiveIds((prev) => new Set(prev).add(event.at));
    };
    return () => source.close();
  }, []);

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center">
        <p className="text-sm text-text-muted">
          Nothing pushed yet. This fills in the moment anyone pushes to a repo with the
          webhook wired up.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {events.map((event, i) => (
        <Row key={`${event.at}-${i}`} event={event} isLive={liveIds.has(event.at)} />
      ))}
    </div>
  );
}
