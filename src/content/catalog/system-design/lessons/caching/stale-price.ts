import { defineLesson } from "@/lib/catalog";

/**
 * The product page reads the price ($49, version 7) through a cache with a 10-second TTL; about 20 shoppers a second.
 * The cached entry expires at 2 s. Ben's page misses at 2.005 s and pauses 200 ms between reading the database and
 * storing the price; the admin changes the price to $39 at 2.03 s. Ana reloads 300 ms after the update is saved, then
 * every 2 s until she sees $39.
 */
const base = {
  seed: 1,
  ttlMs: 10_000,
  slow: { atMs: 2005, stallMs: 200 },
};

export const stalePrice = defineLesson({
  slug: "stale-price",
  topicSlug: "caching",
  title: "The price changed but users see the old one",
  kind: "incident",
  status: "available",
  symptom: "A price was cut, but customers kept seeing the old price for seconds after it was saved.",
  order: 0,
  minutes: 5,
  report: `The admin cuts a product's price from $49 to $39 and sees "saved". Ana reloads the product page: $49. She reloads again: still $49. Ten seconds later it finally says $39.

Then the team adds a fix, and most of the time it works. But now and then the old price comes back right after an update and stays for the full ten seconds.`,
  whatWentWrong: `The page reads the price through a cache, cache-aside: ask the cache; on a miss, read the database and store what it read, for 10 seconds. The admin's update goes to the database only. The cache isn't told, so every read keeps hitting the old $49 until the entry expires.

The first fix deletes the cache entry after updating the database. That handles the common case, but leaves a race. Ben's page missed just before the update, read $49 (version 7) from the database, and paused for a moment. Meanwhile the admin wrote $39 and deleted the entry, and another shopper's read stored $39. Then Ben's page stored the $49 it had read, replacing $39, and the old price stayed for the next 10 seconds.`,
  fix: `**Versioned invalidation:** the price carries its version (it goes up on every write). Deleting the entry leaves a marker with the new version ("price: newest known is version 8"), and the cache keeps a store only if its version is at least the newest it knows. Ben's late "store $49, version 7" is kept out; the next read misses and gets $39.

Real caches can do this check in one step. Memcached's \`cas\` command ("check and set") stores data only if no one else has updated it since the client fetched it, using the value \`gets\` returned; and Redis runs a Lua script atomically, so a script can compare versions and store together.

Alternatives: a short TTL is a good safety net, but it only limits how long a stale price lasts. Leases (the cache hands out a token on a miss, and a delete cancels it) are as strong but need cache support. Writing the new price into the cache on update races with another writer, and deleting twice with a delay only narrows the window.

The cost: every invalidation sends the next reads to the database until one stores the price again.`,
  proofScope: `The proof enumerates every interleaving of one writer's steps (update the database, then invalidate; the update is acknowledged after that) and one or two readers' steps (get from the cache; on a miss, read the database, then store), starting from a cache that holds the old price and from an empty one, with one more read after everything so a stale value left behind always counts. Without invalidation, delete after write, and versioned invalidation are each checked. The rule is zero tolerance: allowing staleness up to the TTL would let the cache that's never told pass. The guarantee needs the database to confirm the write before the invalidation, the invalidation to finish before the update is acknowledged, the cache to make the conditional store in one atomic step, and the cache to keep the version marker longer than any read takes (a test shows a marker that expires during a slow read lets the old price back). Nothing expires within the enumeration; the timed replays show how long stale prices last. Latencies are illustrative.`,
  rules: ["Once a price update is acknowledged, no read that starts after that returns an older price."],
  takeaways: [
    "A cache that isn't told about a write serves the old value until its TTL runs out.",
    "Deleting the entry after the write fixes most reads, but a slow reader can store an old value back.",
    "Versioned invalidation keeps a store only if it's at least the newest version the cache knows.",
    "Every invalidation costs a few database reads; a short TTL is a safety net, not a fix.",
  ],
  replays: [
    {
      args: [
        [
          { label: "not told", ...base, invalidation: "none" },
          { label: "delete", ...base, invalidation: "delete" },
          { label: "versioned", ...base, invalidation: "versioned" },
        ],
        { readers: [1, 2] },
      ],
    },
  ],
  relatedPatterns: [],
  tags: ["caching", "cache invalidation", "consistency"],
});
