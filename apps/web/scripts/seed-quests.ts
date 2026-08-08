// Idempotent — safe to re-run. Upserts on slug rather than truncating, so
// re-running this after someone's already submitted against these quests
// doesn't orphan their quest_submissions rows.
//
// Run via `npm run db:seed-quests` — that script passes --env-file=.env.local
// itself. Don't add an in-file dotenv import here; see the README/worker.ts
// for why that ordering bug is a trap worth not repeating.
import { db } from "../src/server/db";
import { quests } from "../src/server/schema";

async function main() {
  const khaled = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.name, "khaled") });
  if (!khaled) {
    throw new Error("No user named 'khaled' found — sign in once first, then re-run this.");
  }
  const authorId = khaled.id;

  const seedQuests = [
    {
      slug: "reverse-without-recursion",
      title: "Reverse Without Recursion",
      summary: "Reverse a singly linked list in place. No recursion, no extra list.",
      difficulty: "easy" as const,
      tags: ["algorithms", "warmup"],
      points: 20,
      runner: "sandbox-exec" as const,
      runnerSpec: null,
      promptMarkdown: `The classic, for a reason — if you haven't done it in a while, it's worth doing again.

## The problem

Given the head of a singly linked list, reverse it in place and return the new head.

\`\`\`c
struct node {
    int value;
    struct node *next;
};

struct node *reverse(struct node *head) {
    // your turn
}
\`\`\`

## Constraints

- **No recursion.** The iterative version is the point of this one — it's the version that doesn't blow the stack on a 200,000-node list.
- **No allocating a second list.** Rewire the existing nodes' \`next\` pointers; don't build a new structure and throw the old one away.
- O(n) time, O(1) extra space.

## Example

Input: \`1 -> 2 -> 3 -> 4 -> NULL\`
Output: \`4 -> 3 -> 2 -> 1 -> NULL\`

An empty list and a single-node list should both come back correctly reversed, which for those two cases means unchanged.`,
    },
    {
      slug: "the-leaky-bucket",
      title: "The Leaky Bucket",
      summary:
        "A small string-processing tool that leaks memory on every single call. Find it, fix it.",
      difficulty: "medium" as const,
      tags: ["systems", "c", "memory"],
      points: 80,
      runner: "sandbox-exec" as const,
      runnerSpec: null,
      promptMarkdown: `This one's smaller than it looks. That's usually how leaks are.

## The setup

\`\`\`c
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdio.h>

char *shout(const char *input) {
    char *upper = malloc(strlen(input) + 1);
    for (int i = 0; input[i]; i++) {
        upper[i] = toupper((unsigned char) input[i]);
    }
    upper[strlen(input)] = '\\0';

    char *result = malloc(strlen(upper) + 2);
    sprintf(result, "%s!", upper);

    return result;
}
\`\`\`

Called in a loop a few thousand times, this quietly eats memory the whole time. Something allocated in here never gets freed, and it's not the one you'd guess first.

## What to do

Find every allocation in this function (there's more than one), work out which ones the caller is actually responsible for freeing and which ones should never have escaped the function in the first place, and fix it so the function does exactly one heap allocation per call — the one the caller needs back.

## What "done" looks like

- Same behavior: uppercases the input, appends \`!\`, returns a new heap-allocated string the caller owns and frees.
- Runs clean under \`valgrind --leak-check=full\` — zero bytes definitely lost, zero bytes indirectly lost, across a loop of at least 1000 calls.
- No double-frees, no use-after-free. Fixing a leak by freeing too early is a different bug, not a fix.`,
    },
    {
      slug: "the-careless-counter",
      title: "The Careless Counter",
      summary: "Fourteen threads, one counter, zero synchronization. Guess what happens.",
      difficulty: "hard" as const,
      tags: ["systems", "c", "multithreading"],
      points: 150,
      runner: "sandbox-exec" as const,
      runnerSpec: null,
      promptMarkdown: `Somebody on the team wrote a "simple" hit counter for tracking how many times a shared resource gets touched. It compiles. It runs. It even gives a plausible-looking number most of the time.

It's wrong.

## The setup

\`\`\`c
#include <pthread.h>
#include <stdio.h>

static long counter = 0;

void *bump(void *arg) {
    for (int i = 0; i < 100000; i++) {
        counter++;
    }
    return NULL;
}

int main(void) {
    pthread_t threads[8];
    for (int i = 0; i < 8; i++) pthread_create(&threads[i], NULL, bump, NULL);
    for (int i = 0; i < 8; i++) pthread_join(threads[i], NULL);
    printf("%ld\\n", counter);
    return 0;
}
\`\`\`

Run it a few times. \`800000\` is the answer if nothing goes wrong. Nothing going wrong is not guaranteed — \`counter++\` is a read, an increment, and a write, and nothing stops two threads from doing all three at once and clobbering each other's work.

## What to do

Fix it. The final count needs to be correct — deterministically, every run — no matter how many threads are touching it or how the scheduler interleaves them.

You have real options here, not just "add a mutex": a lock, an atomic type, per-thread counters reduced at the end. Pick one and be able to explain why you picked it over the others.

## What "done" looks like

- Compiles clean, no warnings.
- Runs correctly, every time.
- Runs *clean* under ThreadSanitizer (\`-fsanitize=thread\`) — no race reported, not "the race is unlikely," actually clean.
- No busy-waiting that pegs a core for no reason.

That last ThreadSanitizer point isn't optional flavor text — it's literally how this gets graded once the automated reviewer is live. A version that "works" on your machine but a TSan run would flag isn't done.`,
    },
    {
      slug: "extract-failed-logins",
      title: "Extract the Failed Logins",
      summary: "Parse a simple log format and print just the usernames that failed to log in.",
      difficulty: "easy" as const,
      tags: ["bash", "text-processing", "foundations"],
      points: 30,
      runner: "io-match" as const,
      runnerSpec: {
        entryFile: "solution.sh",
        cases: [
          {
            name: "mixed success and failure",
            stdin:
              "2026-01-01T10:00:00 LOGIN user=alice status=success\n" +
              "2026-01-01T10:01:00 LOGIN user=bob status=failed\n" +
              "2026-01-01T10:02:00 LOGIN user=carol status=failed\n" +
              "2026-01-01T10:03:00 LOGIN user=dave status=success",
            expected_stdout: "bob\ncarol",
          },
          {
            name: "no failures",
            stdin: "2026-01-01T10:00:00 LOGIN user=eve status=success",
            expected_stdout: "",
          },
        ],
      },
      promptMarkdown: `Your first Bash quest — this one's graded differently from the C/C++ ones: your \`solution.sh\` gets run against a set of stdin/stdout test cases directly, no valgrind or sanitizers involved. Get the output exactly right and you're done.

## The setup

You're handed log lines like this on stdin, one per line:

\`\`\`
2026-01-01T10:00:00 LOGIN user=alice status=success
2026-01-01T10:01:00 LOGIN user=bob status=failed
2026-01-01T10:02:00 LOGIN user=carol status=failed
2026-01-01T10:03:00 LOGIN user=dave status=success
\`\`\`

## What to do

Write \`solution.sh\` (a Bash script) that reads lines from stdin and prints
the username of every \`status=failed\` line, one per line, in the order
they appeared — nothing else. For the example above, that's:

\`\`\`
bob
carol
\`\`\`

If nothing failed, print nothing.

## What "done" looks like

- Exact output, including order — this is graded by direct comparison
  against expected output, not a fuzzy match.
- No dependency beyond what a stock \`bash\` gives you — no \`grep -P\`,
  no \`jq\`, no assuming a tool exists beyond core Bash builtins and
  standard POSIX utilities. Part of the point is doing this with the
  tools that are always there.
- Handles the empty-result case (no failed logins) by printing nothing,
  not an error.`,
    },
    {
      slug: "three-clean-commits",
      title: "Three Clean Commits",
      summary: "Shape your git history — exactly three commits, real messages, no merge noise.",
      difficulty: "easy" as const,
      tags: ["git", "foundations"],
      points: 30,
      runner: "git-assert" as const,
      runnerSpec: {
        baseRef: "main",
        assertions: [
          { type: "no-merge-commits" },
          { type: "commit-count", op: "eq", value: 3 },
          { type: "commit-message-matches", pattern: "^(feat|fix|docs|refactor|chore): .+" },
        ],
      },
      promptMarkdown: `Most people's git history reads like a stream of consciousness: "wip", "fix", "actually fix", "why doesn't this work", "ok now it works". That's fine while you're heads-down. It's not fine by the time you open a pull request.

## What to do

Shape your history into **exactly three commits**, each following [Conventional Commits](https://www.conventionalcommits.org/) — \`feat:\`, \`fix:\`, \`docs:\`, \`refactor:\`, or \`chore:\`, followed by a real description — with no merge commits in the branch. If you pick up changes from \`main\` along the way, \`rebase\`, don't \`merge\`.

It doesn't matter what the three commits actually *do* — this quest is graded on the shape of your history, not your files' contents. Write three real, distinct commits about anything you like (fix a typo, add a comment, whatever), following the message format above.

## What "done" looks like

- Exactly 3 commits ahead of \`main\`.
- Every one of them starts with \`feat:\`, \`fix:\`, \`docs:\`, \`refactor:\`, or \`chore:\`, followed by a real description — not just the bare tag.
- No merge commits anywhere in the branch.

Unlike the C/C++ or Bash quests, nothing here runs or compiles — this one's graded by inspecting your actual \`git log\`, not your code's output.`,
    },
    {
      slug: "containerize-it-right",
      title: "Containerize It Right",
      summary: "Write a Dockerfile that builds clean, runs as a real user, and stays small.",
      difficulty: "easy" as const,
      tags: ["docker", "foundations"],
      points: 40,
      runner: "dockerfile-check" as const,
      runnerSpec: {
        assertions: [
          { type: "builds-successfully" },
          { type: "runs-as-non-root" },
          { type: "no-latest-tag" },
          { type: "image-size-under", megabytes: 200 },
          { type: "hadolint-clean" },
        ],
      },
      promptMarkdown: `A Dockerfile that builds is the easy part. One that builds *responsibly* is what actually gets reviewed favorably: a pinned base, a real non-root user, no wasted layers, nothing a linter would flag on sight.

## What to do

Add a single file at the root of your repo, \`Dockerfile\`, that builds an image around any tiny script or command you like. What the container actually does when it runs does not matter, this quest is graded on how the Dockerfile is built, not the payload inside it.

Your \`Dockerfile\` needs to:

- **Build successfully**, no manual flags or context beyond the repo root.
- **Pin its base image to a real tag**, not \`:latest\` and not an implicit, untagged \`FROM\` line.
- **Run as a non root user.** Create one, switch to it with \`USER\`, and do not leave the container running as root by default.
- **Stay under 200MB.** A slim base and a minimal install list get you there easily, an unpinned \`apt-get install\` with no cleanup usually will not.
- **Pass hadolint clean.** No warnings, no errors, nothing.

## What "done" looks like

- \`docker build\` succeeds against your repo as is.
- The built image's \`USER\` is set to something other than root.
- The \`FROM\` line names a real, non \`latest\` tag.
- The image comes in under 200MB.
- hadolint reports zero findings against your \`Dockerfile\`.

This one is graded by actually building your image in a locked down, network restricted sandbox and inspecting the result, plus a static lint pass, not by a human skimming your Dockerfile.`,
    },
  ];

  for (const quest of seedQuests) {
    await db
      .insert(quests)
      .values({ ...quest, authorId, status: "published" })
      .onConflictDoUpdate({
        target: quests.slug,
        set: {
          title: quest.title,
          summary: quest.summary,
          difficulty: quest.difficulty,
          tags: quest.tags,
          points: quest.points,
          runner: quest.runner,
          runnerSpec: quest.runnerSpec,
          promptMarkdown: quest.promptMarkdown,
          updatedAt: new Date(),
        },
      });
    console.log(`seeded: ${quest.slug}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
