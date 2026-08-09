// Idempotent — safe to re-run. Upserts on slug rather than truncating, so
// re-running this after someone's already submitted against these quests
// doesn't orphan their quest_submissions rows.
//
// Run via `npm run db:seed-quests` — that script passes --env-file=.env.local
// itself. Don't add an in-file dotenv import here; see the README/worker.ts
// for why that ordering bug is a trap worth not repeating.
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/server/db";
import { paths, pathQuests, quests } from "../src/server/schema";

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
      // No in-house concept teaching, just the problem and constraints —
      // pure by docs/MASTER_PLAN.md §1.5's definition, not a style left unchosen.
      style: "pure" as const,
      difficulty: "easy" as const,
      tags: ["algorithms", "warmup"],
      points: 20,
      researchKeywords: ["linked list", "iterative pointer reversal", "in-place algorithm"],
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
      style: "pure" as const,
      difficulty: "medium" as const,
      tags: ["systems", "c", "memory"],
      points: 80,
      researchKeywords: ["malloc/free ownership", "valgrind --leak-check", "heap allocation lifetime"],
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
      // The one quest in this retrofit that actually earns "educational":
      // primerMarkdown below explains the race-condition mechanism itself
      // before the challenge, a real brief concept primer, not just
      // problem framing — split out (Phase 8) so the UI can render it as
      // its own distinct surface instead of folding it into the same
      // prose as the challenge.
      style: "educational" as const,
      difficulty: "hard" as const,
      tags: ["systems", "c", "multithreading"],
      points: 150,
      runner: "sandbox-exec" as const,
      runnerSpec: null,
      primerMarkdown: `A **race condition** happens when two or more threads touch the same piece of shared state without coordination, and the final result depends on the order the scheduler happens to interleave them — an order you don't control and can't rely on being consistent between runs.

The classic trap: an operation that looks like one step in source code often isn't one step in hardware. \`counter++\` reads the current value, adds one, then writes it back — three distinct steps. If two threads each start that sequence before either finishes it, one thread's write can silently overwrite the other's, and an increment gets lost. Run the same program twice and you can get two different, both wrong, answers.

Fixing this means making the read-modify-write sequence atomic, so no other thread can observe or interleave with it mid-flight, whether through a lock, an atomic type, or by restructuring the work so nothing is actually shared.`,
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

Run it a few times. \`800000\` is the answer if nothing goes wrong. Nothing going wrong is not guaranteed.

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
      style: "pure" as const,
      difficulty: "easy" as const,
      tags: ["bash", "text-processing", "foundations"],
      points: 30,
      researchKeywords: ["grep", "awk field extraction", "reading stdin line by line in bash"],
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
      // Points externally to the Conventional Commits spec rather than
      // teaching it in-house — that's the pure pattern (keyword pointer for
      // external research), not an educational primer.
      style: "pure" as const,
      difficulty: "easy" as const,
      tags: ["git", "foundations"],
      points: 30,
      researchKeywords: ["Conventional Commits", "git rebase -i", "git commit --amend"],
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
      style: "pure" as const,
      difficulty: "easy" as const,
      tags: ["docker", "foundations"],
      points: 40,
      researchKeywords: ["Dockerfile USER instruction", "pinned base image tags", "hadolint"],
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
    {
      slug: "tally-the-status-codes",
      title: "Tally the Status Codes",
      summary: "Count how often each HTTP status code shows up, sorted lowest to highest.",
      style: "pure" as const,
      difficulty: "medium" as const,
      tags: ["bash", "text-processing", "foundations"],
      points: 45,
      researchKeywords: ["awk associative arrays", "sort -n", "uniq -c"],
      runner: "io-match" as const,
      runnerSpec: {
        entryFile: "solution.sh",
        cases: [
          {
            name: "mixed status codes",
            stdin:
              "GET /home 200\nGET /missing 404\nPOST /login 200\nGET /error 500\nGET /home 200",
            expected_stdout: "200 3\n404 1\n500 1",
          },
          {
            name: "single line",
            stdin: "GET /ok 200",
            expected_stdout: "200 1",
          },
        ],
      },
      promptMarkdown: `A step up from the last one: this time you're aggregating, not just filtering.

## The setup

Log lines on stdin, one per line, always ending in a status code as the last field:

\`\`\`
GET /home 200
GET /missing 404
POST /login 200
GET /error 500
GET /home 200
\`\`\`

## What to do

Write \`solution.sh\` that counts how many times each status code appears, then prints one line per distinct code as \`CODE COUNT\`, sorted numerically by code, ascending. For the example above:

\`\`\`
200 3
404 1
500 1
\`\`\`

## What "done" looks like

- One line per distinct status code, sorted ascending by code, exact format \`CODE COUNT\` separated by a single space.
- No dependency beyond stock \`bash\` and standard POSIX utilities (\`awk\`, \`sort\`, \`uniq\` are all fair game, this one is genuinely awkward without them).
- Handles a single-line input correctly, not just multi-line ones.`,
    },
    {
      slug: "group-the-sessions",
      title: "Group the Sessions",
      summary: "Parse blank-line-separated key=value blocks into one summary line per block.",
      style: "pure" as const,
      difficulty: "hard" as const,
      tags: ["bash", "text-processing", "foundations"],
      points: 65,
      researchKeywords: ["bash associative arrays (declare -A)", "record-oriented parsing", "IFS and read"],
      runner: "io-match" as const,
      runnerSpec: {
        entryFile: "solution.sh",
        cases: [
          {
            name: "two sessions",
            stdin:
              "user=alice\nduration=120\nstatus=ok\n\nuser=bob\nstatus=timeout\nduration=45\n",
            expected_stdout: "alice 120 ok\nbob 45 timeout",
          },
          {
            name: "single session, no trailing blank line",
            stdin: "user=carol\nduration=10\nstatus=ok\n",
            expected_stdout: "carol 10 ok",
          },
        ],
      },
      promptMarkdown: `The hardest of the Bash Foundations quests so far: real state tracking across multiple lines, not a single pass over independent ones.

## The setup

stdin holds a series of session records. Each record is a few \`key=value\` lines, always exactly \`user\`, \`duration\`, and \`status\`, in no particular order, and records are separated by a single blank line:

\`\`\`
user=alice
duration=120
status=ok

user=bob
status=timeout
duration=45
\`\`\`

## What to do

Write \`solution.sh\` that prints one line per session, in the order the sessions appeared, formatted as \`USER DURATION STATUS\` (that field order, regardless of what order the keys appeared in the input). For the example above:

\`\`\`
alice 120 ok
bob 45 timeout
\`\`\`

## What "done" looks like

- One output line per input session, in input order, exact \`USER DURATION STATUS\` format.
- Handles a trailing blank line between sessions or none at all, the very last session in the input might not be followed by one.
- Handles the keys arriving in any order within a block, don't assume \`user\` always comes first.
- No dependency beyond stock \`bash\`. Associative arrays (\`declare -A\`) are exactly the right tool here.`,
    },
    {
      slug: "no-giant-commits",
      title: "No Giant Commits",
      summary: "Break your work into at least four real commits instead of one that does everything.",
      style: "pure" as const,
      difficulty: "medium" as const,
      tags: ["git", "foundations"],
      points: 35,
      researchKeywords: ["git rebase", "atomic commits", "git log --oneline"],
      runner: "git-assert" as const,
      runnerSpec: {
        baseRef: "main",
        assertions: [
          { type: "no-merge-commits" },
          { type: "commit-count", op: "min", value: 4 },
        ],
      },
      promptMarkdown: `The opposite failure mode from "Three Clean Commits": instead of a messy trail of "wip" commits, this is the one giant commit that changes twelve files and calls itself "updates". Reviewers hate both.

## What to do

Make **at least four commits** on top of \`main\`, no merge commits in the branch. It doesn't matter what they do or exactly how you word them, this quest is graded purely on commit count and history shape, not message format or file contents. What matters is that the work is actually broken up: each commit should be a real, self-contained step, not a rebase trick to inflate the count.

If you pick up changes from \`main\` along the way, \`rebase\`, don't \`merge\`.

## What "done" looks like

- At least 4 commits ahead of \`main\`.
- No merge commits anywhere in the branch.

Graded by inspecting your actual \`git log\`, same as the other Git quests, nothing here runs or compiles.`,
    },
    {
      slug: "scoped-and-squashed",
      title: "Scoped and Squashed",
      summary: "Squash down to five commits or fewer, each with a proper type(scope): message.",
      style: "pure" as const,
      difficulty: "hard" as const,
      tags: ["git", "foundations"],
      points: 55,
      researchKeywords: ["git rebase -i", "Conventional Commits scopes", "squashing commits"],
      runner: "git-assert" as const,
      runnerSpec: {
        baseRef: "main",
        assertions: [
          { type: "no-merge-commits" },
          { type: "commit-count", op: "max", value: 5 },
          { type: "commit-message-matches", pattern: "^(feat|fix|docs|refactor|chore)\\([a-z0-9-]+\\): .+" },
        ],
      },
      promptMarkdown: `The other direction from "No Giant Commits": now you've got a branch with a real history, and the job is to tighten it before it's reviewable, without losing the shape of the work.

## What to do

Get your branch down to **five commits or fewer** ahead of \`main\`, no merges, and every single commit message needs a **scope**, not just a bare Conventional Commits type. That means \`feat(auth): add token refresh\`, not \`feat: add token refresh\`, and definitely not \`feat: stuff\`.

The exact pattern each message needs to match: \`type(scope): description\`, where \`type\` is one of \`feat\`, \`fix\`, \`docs\`, \`refactor\`, or \`chore\`, \`scope\` is lowercase letters, digits, or hyphens, and \`description\` is a real sentence fragment, not empty.

As before, it doesn't matter what the commits actually change, write real, distinct commits about whatever you like, this is graded on history shape and message format, not file contents. \`rebase -i\` is the tool for this, not \`git reset --soft\` and one big recommit, though either gets you to a valid end state.

## What "done" looks like

- 5 or fewer commits ahead of \`main\`.
- No merge commits anywhere in the branch.
- Every commit message matches \`type(scope): description\`, scope included, every time.`,
    },
    {
      slug: "slim-it-down",
      title: "Slim It Down",
      summary: "Same rules as Containerize It Right, but the image has to stay under 50MB.",
      style: "pure" as const,
      difficulty: "medium" as const,
      tags: ["docker", "foundations"],
      points: 45,
      researchKeywords: ["multi-stage Docker builds", "alpine/distroless base images", "image layer size"],
      runner: "dockerfile-check" as const,
      runnerSpec: {
        assertions: [
          { type: "builds-successfully" },
          { type: "runs-as-non-root" },
          { type: "no-latest-tag" },
          { type: "image-size-under", megabytes: 50 },
          { type: "hadolint-clean" },
        ],
      },
      promptMarkdown: `"Containerize It Right" set a 200MB ceiling, generous enough that almost any reasonable base image clears it without much thought. This one doesn't give you that room.

## What to do

Same core requirements as before: a \`Dockerfile\` at the repo root, builds cleanly, pins a real base tag, runs as a non root user, hadolint clean. The difference is the size budget: **under 50MB**, total.

That number rules out a lot of default choices. A full Debian or Ubuntu base alone is usually already past it once you add anything on top. Getting under 50MB means actually thinking about what your base image needs to contain, and probably means reaching for something built for exactly this (a slim or alpine variant, or trimming what you install to the bare minimum your one script actually needs).

## What "done" looks like

- \`docker build\` succeeds against your repo as is.
- The built image's \`USER\` is set to something other than root.
- The \`FROM\` line names a real, non \`latest\` tag.
- The image comes in under 50MB.
- hadolint reports zero findings.`,
    },
    {
      slug: "ship-it-with-a-healthcheck",
      title: "Ship It With a Healthcheck",
      summary: "A Dockerfile isn't production ready until something can ask it if it's alive.",
      style: "pure" as const,
      difficulty: "hard" as const,
      tags: ["docker", "foundations"],
      points: 55,
      researchKeywords: ["Dockerfile HEALTHCHECK instruction", "container liveness checks", "entrypoint scripts"],
      runner: "dockerfile-check" as const,
      runnerSpec: {
        assertions: [
          { type: "builds-successfully" },
          { type: "runs-as-non-root" },
          { type: "no-latest-tag" },
          { type: "has-healthcheck" },
          { type: "hadolint-clean" },
        ],
      },
      promptMarkdown: `Every quest so far has asked "does it build cleanly." This one asks a different question: once it's running, how would anything else know?

## What to do

Same non root, pinned tag, hadolint clean baseline as the other Docker quests, plus one new requirement: a real \`HEALTHCHECK\` instruction. It needs to actually check something meaningful, running your container's own entrypoint script (or an equivalent real command) counts, a hardcoded \`CMD ["true"]\` that always succeeds regardless of anything technically satisfies the instruction but misses the point entirely.

## What "done" looks like

- \`docker build\` succeeds against your repo as is.
- The built image's \`USER\` is set to something other than root.
- The \`FROM\` line names a real, non \`latest\` tag.
- The built image has a \`HEALTHCHECK\` set.
- hadolint reports zero findings.`,
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
          style: quest.style,
          tags: quest.tags,
          points: quest.points,
          runner: quest.runner,
          runnerSpec: quest.runnerSpec,
          promptMarkdown: quest.promptMarkdown,
          primerMarkdown: "primerMarkdown" in quest ? quest.primerMarkdown : null,
          researchKeywords: "researchKeywords" in quest ? quest.researchKeywords : [],
          updatedAt: new Date(),
        },
      });
    console.log(`seeded: ${quest.slug}`);
  }

  // The platform's first real Mastery Path (docs/MASTER_PLAN.md §1.5/§3.5)
  // — organizes the 12 quests above rather than introducing new ones.
  // Ordering is tier-interleaved across all four tracks (easy tier, then
  // medium, then hard), not track-blocked (all of Git, then all of Bash,
  // ...), per the interleaved-practice research cited in §1.5: spacing
  // different skills within a sequence measurably beats block formats.
  // Git leads every tier, matching §1's "flagship track, not filler"
  // finding; C/C++ trails every tier, matching §1's framing of it as the
  // platform's existing differentiator folded into this launch Path
  // rather than a separate track.
  const [{ id: pathId }] = await db
    .insert(paths)
    .values({
      slug: "backend-engineering-foundations",
      title: "Backend Engineering Foundations",
      summary:
        "Git, Bash/Linux, Docker, and systems C/C++ — the four tracks that make a backend dev competitive, in one curated sequence.",
      status: "published",
      authorId,
    })
    .onConflictDoUpdate({
      target: paths.slug,
      set: {
        title: "Backend Engineering Foundations",
        summary:
          "Git, Bash/Linux, Docker, and systems C/C++ — the four tracks that make a backend dev competitive, in one curated sequence.",
        status: "published",
        updatedAt: new Date(),
      },
    })
    .returning({ id: paths.id });

  const pathOrder = [
    "three-clean-commits",
    "extract-failed-logins",
    "containerize-it-right",
    "reverse-without-recursion",
    "no-giant-commits",
    "tally-the-status-codes",
    "slim-it-down",
    "the-leaky-bucket",
    "scoped-and-squashed",
    "group-the-sessions",
    "ship-it-with-a-healthcheck",
    "the-careless-counter",
  ];

  const orderedQuests = await db.query.quests.findMany({ where: inArray(quests.slug, pathOrder) });
  const questIdBySlug = new Map(orderedQuests.map((q) => [q.slug, q.id]));

  // Delete-then-bulk-insert, not a per-row upsert keyed on (pathId, questId)
  // alone: path_quests also has a unique constraint on (pathId, orderIndex),
  // and reordering pathOrder (swapping two slugs, inserting one in the
  // middle) would have a still-unprocessed row holding the orderIndex an
  // earlier row is being updated to, tripping that second constraint — one
  // ON CONFLICT target can't arbitrate both at once. Wrapped in a
  // transaction so a mid-loop failure can't leave the path half-reordered.
  await db.transaction(async (tx) => {
    await tx.delete(pathQuests).where(eq(pathQuests.pathId, pathId));
    await tx.insert(pathQuests).values(
      pathOrder.map((slug, orderIndex) => {
        const questId = questIdBySlug.get(slug);
        if (!questId) {
          throw new Error(`pathOrder references "${slug}", but no such quest was seeded above`);
        }
        return { pathId, questId, orderIndex };
      }),
    );
  });
  console.log(`seeded path: backend-engineering-foundations (${pathOrder.length} quests)`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
