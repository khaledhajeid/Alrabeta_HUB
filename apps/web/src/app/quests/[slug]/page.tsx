import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { quests, questSubmissions, badges } from "@/server/schema";
import { getPeerSolutions } from "@/server/peer-solutions";
import { TagPill } from "@/components/tag-pill";
import { QuestMarkdown } from "@/components/quest-markdown";
import { QuestPrimer } from "@/components/quest-primer";
import { ResearchHints } from "@/components/research-hints";
import { QuestStyleBadge } from "@/components/quest-style-badge";
import { BadgePill } from "@/components/badge-pill";
import { SubmissionStatus } from "@/components/submission-status";
import { TAG_TO_BADGE_SLUG } from "@/lib/badge-info";

// Pinned to UTC rather than the server's own local time: this renders in a
// server component with no client re-render to correct it, so leaving the
// timezone implicit would make the displayed date depend on wherever the
// process happens to run (differs between local dev and prod) instead of
// being a fixed, reproducible value.
function formatPassedDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const quest = await db.query.quests.findFirst({
    where: and(eq(quests.slug, slug), eq(quests.status, "published")),
    with: { author: { columns: { name: true } } },
  });
  if (!quest) notFound();

  const session = await auth.api.getSession({ headers: await headers() });

  const submissions = session
    ? await db.query.questSubmissions.findMany({
        where: and(
          eq(questSubmissions.questId, quest.id),
          eq(questSubmissions.userId, session.user.id),
        ),
        orderBy: desc(questSubmissions.submittedAt),
      })
    : [];

  // Gated on the viewer's own pass, derived from the submissions query
  // already run above rather than a second round trip — peer solutions
  // only fetched once that gate is actually open.
  const hasPassed = submissions.some((s) => s.status === "passed");

  // Independent of each other (badges key off submissions already in hand;
  // peers key off quest+viewer), so they run together rather than paying
  // two sequential round trips.
  const [submissionBadges, peerSolutions] = await Promise.all([
    submissions.length > 0
      ? db.query.badges.findMany({
          where: inArray(
            badges.questSubmissionId,
            submissions.map((s) => s.id),
          ),
        })
      : Promise.resolve([]),
    session && hasPassed ? getPeerSolutions(quest.id, session.user.id) : Promise.resolve([]),
  ]);
  const badgesBySubmission = new Map<string, string[]>();
  for (const b of submissionBadges) {
    const existing = badgesBySubmission.get(b.questSubmissionId) ?? [];
    existing.push(b.slug);
    badgesBySubmission.set(b.questSubmissionId, existing);
  }

  const eligibleBadgeSlug = quest.tags.map((t) => TAG_TO_BADGE_SLUG[t]).find(Boolean);

  const branchName = `quest/${quest.slug}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-text">{quest.title}</h1>
        <span className="font-mono text-xs text-text-muted">{quest.difficulty}</span>
        {quest.tags.map((t) => (
          <TagPill key={t} tag={t} />
        ))}
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
        <span>
          {quest.points} pts · by {quest.author?.name ?? "unknown"}
        </span>
        <QuestStyleBadge style={quest.style} />
      </p>
      {/* Shown before the quest is ever solved — the badge system used to
          be invisible until you'd already earned one blindly. */}
      {eligibleBadgeSlug && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-muted">
          Solve this clean to earn <BadgePill slug={eligibleBadgeSlug} />
        </p>
      )}

      {/* One reading column for everything below the header — prose, the
          submit instructions, and submission history all share the same
          measure rather than the width jumping partway down the page. */}
      <div className="mt-8 max-w-[70ch]">
        {quest.style === "educational" && quest.primerMarkdown && (
          <QuestPrimer markdown={quest.primerMarkdown} />
        )}

        <QuestMarkdown markdown={quest.promptMarkdown} />

        {quest.style === "pure" && <ResearchHints keywords={quest.researchKeywords} />}

        <div className="mt-10 rounded-lg bg-surface p-5 shadow-resting">
          <h2 className="font-mono text-sm font-semibold text-text">How to submit</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            Solve it in a branch named exactly this, push it, and it&rsquo;s tagged as an attempt
            automatically — no separate submit button.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-ink px-4 py-3 font-mono text-sm text-text">
            git checkout -b {branchName}
          </pre>
        </div>

        <div className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-text-muted">Your submissions</h2>
          {!session ? (
            <div className="rounded-lg border border-dashed border-line px-5 py-8 text-center">
              <p className="text-sm text-text-muted">
                Sign in with Forgejo (top right) to submit.
              </p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line px-5 py-8 text-center">
              <p className="text-sm text-text-muted">
                Nothing yet — push to <code className="font-mono text-text">{branchName}</code>{" "}
                to show up here.
              </p>
            </div>
          ) : (
            // Phase 7.5.F: this is the row the whole redesign was really
            // about — a submission result used to be a plain text label,
            // the same visual weight as its own commit SHA. reveal-list
            // gives it the entrance 7.5.C deliberately deferred to here.
            <div className="reveal-list divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-resting">
              {submissions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="font-mono text-xs text-text-muted">
                    {s.commitSha.slice(0, 8)}
                  </span>
                  <div className="flex items-center gap-2">
                    {(badgesBySubmission.get(s.id) ?? []).map((slug) => (
                      <BadgePill key={slug} slug={slug} />
                    ))}
                    <SubmissionStatus status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {session && (
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-medium text-text-muted">Who else solved this</h2>
            {!hasPassed ? (
              <div className="rounded-lg border border-dashed border-line px-5 py-8 text-center">
                <p className="text-sm text-text-muted">
                  Pass this quest to see how others solved it.
                </p>
              </div>
            ) : peerSolutions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line px-5 py-8 text-center">
                <p className="text-sm text-text-muted">
                  You&rsquo;re the first to solve this — nobody else has, yet.
                </p>
              </div>
            ) : (
              <div className="reveal-list divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-resting">
                {peerSolutions.map((peer) => {
                  const content = (
                    <>
                      <div className="flex min-w-0 items-center gap-2.5">
                        {peer.image ? (
                          <Image
                            src={peer.image}
                            alt={`${peer.name}'s avatar`}
                            width={28}
                            height={28}
                            className="h-7 w-7 shrink-0 rounded-full"
                          />
                        ) : (
                          <div className="h-7 w-7 shrink-0 rounded-full bg-surface-2" aria-hidden />
                        )}
                        <span className="truncate text-sm font-medium text-text">{peer.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 pl-[38px] sm:pl-0">
                        <div className="flex items-center gap-2">
                          {peer.badgeSlugs.map((slug) => (
                            <BadgePill key={slug} slug={slug} />
                          ))}
                        </div>
                        <span className="font-mono text-xs text-text-muted">
                          {formatPassedDate(peer.passedAt)}
                        </span>
                      </div>
                    </>
                  );
                  // The badge+date group is fixed-width content (a pill plus
                  // a date, neither of which should truncate) sharing the
                  // row with a name that needs real space to stay readable
                  // — at narrow widths there isn't room for both side by
                  // side, so this stacks instead of squeezing the name
                  // toward one letter. Same responsive shape the repo
                  // detail page's own header already uses for the same
                  // reason.
                  const rowClassName =
                    "flex flex-col items-start gap-2 px-5 py-3 transition-[background-color,transform] duration-(--motion-fast) ease-(--ease-out-quint) sm:flex-row sm:items-center sm:justify-between sm:gap-4";
                  return peer.commitUrl ? (
                    <a
                      key={peer.userId}
                      href={peer.commitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`${rowClassName} hover:translate-x-0.5 hover:bg-surface-2`}
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={peer.userId} className={rowClassName}>
                      {content}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
