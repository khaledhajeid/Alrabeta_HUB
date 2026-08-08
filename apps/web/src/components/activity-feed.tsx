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

// Phase 7.5.E: a live push feed is a sequence of moments in time, not a
// bordered box of rows — the same divide-y card wrapper every other list
// on this site used to share. It sits directly on the page canvas; the
// connecting line does the grouping work the border used to.
function Row({
  event,
  isLive,
  isLast,
}: {
  event: ActivityEvent;
  isLive?: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {!isLast && (
        <span aria-hidden className="absolute top-3 bottom-0 left-[5px] w-px bg-line" />
      )}
      {/* ring-ink "cuts" the connecting line where the node sits, so the
          dot reads as a node on the line rather than overlapping it. */}
      <span
        className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-ink ${
          isLive ? "bg-signal" : "border border-line bg-surface-2"
        }`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-sm text-text">
            <span className="font-medium">{event.pusher}</span> pushed{" "}
            {event.commitCount} {event.commitCount === 1 ? "commit" : "commits"} to{" "}
            <span className="font-mono text-text-muted">
              {event.repo}@{event.branch}
            </span>
          </div>
          <span className="shrink-0 font-mono text-xs text-text-muted">{timeAgo(event.at)}</span>
        </div>
        {event.headMessage && (
          <div className="mt-0.5 truncate font-mono text-sm text-text-muted">
            {event.headMessage.split("\n")[0]}
          </div>
        )}
      </div>
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
    <div className="reveal-list">
      {events.map((event, i) => (
        <Row
          key={`${event.at}-${i}`}
          event={event}
          isLive={liveIds.has(event.at)}
          isLast={i === events.length - 1}
        />
      ))}
    </div>
  );
}
