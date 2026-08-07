import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { quests, questSubmissions } from "@/server/schema";
import { TagPill } from "@/components/tag-pill";
import { QuestMarkdown } from "@/components/quest-markdown";

const SUBMISSION_LABEL: Record<string, string> = {
  submitted: "Submitted",
  passed: "Passed",
  failed: "Failed",
  needs_review: "Needs review",
};

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
      <p className="mt-1.5 text-sm text-text-muted">
        {quest.points} pts · by {quest.author?.name ?? "unknown"}
      </p>

      {/* One reading column for everything below the header — prose, the
          submit instructions, and submission history all share the same
          measure rather than the width jumping partway down the page. */}
      <div className="mt-8 max-w-[70ch]">
        <QuestMarkdown markdown={quest.promptMarkdown} />

        <div className="mt-10 rounded-lg border border-line bg-surface p-5">
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
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {submissions.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <span className="font-mono text-xs text-text-muted">
                    {s.commitSha.slice(0, 8)}
                  </span>
                  <span className="text-sm text-text">
                    {SUBMISSION_LABEL[s.status] ?? s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
