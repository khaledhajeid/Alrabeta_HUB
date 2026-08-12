// Idempotent — safe to re-run, upserts on slug like seed-quests.ts. No admin
// panel exists yet (Phase 10), so this script is the authoring path for the
// shop catalog: add/edit an entry below, re-run, done.
//
// Run via `npm run db:seed-shop-items` — that script passes --env-file=.env.local
// itself.
import { db } from "../src/server/db";
import { shopItems } from "../src/server/schema";

async function main() {
  const items = [
    // Flair — owned-forever, equip one at a time. flairGlyph is a key into
    // src/components/shop-icons.tsx's icon map, not literal rendered text.
    {
      slug: "flair-spark",
      name: "Spark",
      description: "A small mark next to your name — nothing loud, just a signal you spent something on how you show up.",
      category: "flair" as const,
      price: 25,
      flairGlyph: "spark",
      repeatable: false,
      stock: null,
    },
    {
      slug: "flair-comet",
      name: "Comet",
      description: "Same idea as Spark, one step brighter.",
      category: "flair" as const,
      price: 35,
      flairGlyph: "comet",
      repeatable: false,
      stock: null,
    },
    {
      slug: "flair-prism",
      name: "Prism",
      description: "The showiest of the three, which at this scale still isn't very.",
      category: "flair" as const,
      price: 50,
      flairGlyph: "prism",
      repeatable: false,
      stock: null,
    },
    // Titles — owned-forever, equip one at a time, shown next to your name
    // on Profile and the leaderboard.
    {
      slug: "title-night-owl",
      name: "Night Owl",
      description: "For whenever you actually did most of your solving.",
      category: "title" as const,
      price: 40,
      flairGlyph: null,
      repeatable: false,
      stock: null,
    },
    {
      slug: "title-the-regular",
      name: "The Regular",
      description: "You keep showing up. This says so.",
      category: "title" as const,
      price: 40,
      flairGlyph: null,
      repeatable: false,
      stock: null,
    },
    {
      slug: "title-committed",
      name: "Committed",
      description: "A pun you've earned the right to wear. Not the git kind.",
      category: "title" as const,
      price: 60,
      flairGlyph: null,
      repeatable: false,
      stock: null,
    },
    // Feature — repeatable, each purchase is its own 24-hour redemption.
    {
      slug: "feature-spotlight",
      name: "Spotlight",
      description: "Tags your next push on the Activity feed for 24 hours.",
      category: "activity_feature" as const,
      price: 20,
      flairGlyph: null,
      repeatable: true,
      stock: null,
    },
    // Real-world rewards — repeatable, no code behind the redemption. An
    // admin fulfills these by hand once purchased; stock caps keep the
    // pricier ones from piling up faster than an admin can keep up.
    {
      slug: "reward-pick-next-quest",
      name: "Pick the Next Quest",
      description:
        "Name a real problem and it becomes an actual quest on the platform. No code behind this one — just tell an admin what you want built.",
      category: "real_world_reward" as const,
      price: 200,
      flairGlyph: null,
      repeatable: true,
      stock: 2,
    },
    {
      slug: "reward-coffee",
      name: "Coffee's On Me",
      description: "Redeem in person for an actual coffee, on the house. Find an admin.",
      category: "real_world_reward" as const,
      price: 60,
      flairGlyph: null,
      repeatable: true,
      stock: 5,
    },
  ];

  for (const item of items) {
    await db
      .insert(shopItems)
      .values(item)
      .onConflictDoUpdate({
        target: shopItems.slug,
        set: {
          name: item.name,
          description: item.description,
          category: item.category,
          price: item.price,
          flairGlyph: item.flairGlyph,
          repeatable: item.repeatable,
          stock: item.stock,
        },
      });
    console.log(`seeded: ${item.slug}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
