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
