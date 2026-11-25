import { defineLesson } from "@/lib/catalog";

/**
 * The home page is built from 4 cached entries (trending, deals, banner, categories), all filled by a deploy at 0 s
 * with a 10-second TTL. 500 page views a second; the database has 8 workers, a 64-request queue, and ~50 ms queries;
 * pages time out after 500 ms. The first three page views to miss "trending" after it expires are followed.
 */
const base = { seed: 1, keys: 4, rps: 500, trafficFromMs: 7500 };

export const stampede = defineLesson({
  slug: "stampede",
  topicSlug: "caching",
  title: "Everything fell over when the cache expired",
  kind: "incident",
  status: "available",
  symptom: "The home page's cache entries expired and the database fell over a moment later.",
  order: 1,
  minutes: 5,
  report: `The home page is assembled from a few cached entries: trending, deals, banner, and categories. At 500 page views a second almost every read hits the cache, and the database sits nearly idle.

Ten seconds after a deploy, the database's queue fills up in an instant, pages slow to almost half a second, and some fail outright. A moment later everything is calm again.`,
  whatWentWrong: `The deploy filled all four entries at once with the same 10-second TTL, so they all expired at the same moment. Every page view in the next instant missed all four and queried the database for them: 76 queries for 4 values, against 8 workers. The queue filled to its limit of 64, the last pages in line were turned away, and the others waited behind dozens of identical queries.`,
  fix: `Two fixes, each for one part of it.

- **Single-flight (request coalescing):** the first miss for a key fetches it; any other miss for the same key on the same app node waits for that one result instead of querying the database. One query per key per expiry.
- **Jittered TTLs:** when many keys are set at once (after a deploy or a cache restart), give each a TTL within 20% of the target, so they expire seconds apart instead of together.

Single-flight alone isn't enough when many keys expire together: each still sends one query, and 32 keys against 8 workers queue 24 deep. Jitter spreads them out.

Two other approaches, not simulated: **serving the stale value while one request refreshes it** (stale-while-revalidate) means nobody waits, but users briefly see old data; **refreshing before expiry** avoids the miss but adds database reads and needs its timing tuned.

The cost: a request that waits takes as long as the fetch it waits on. And single-flight works per app node: three app nodes coalescing on their own send up to three fetches per key, unless they coordinate (for example, with a short lock in the shared cache, which then needs its own expiry).`,
  proofScope: `The simulation checks both rules over seeds 1–10, 200, 500, and 1,000 page views a second, and 1, 4, 16, and 32 keys filled by one deploy, on one app node with 8 database workers. Rule 1 counts every fetch sent to the database, queued or running. Without a fix a rule breaks in 119 of 120 runs; jitter alone still sends duplicate fetches and fills the queue; single-flight alone keeps rule 1 everywhere but breaks rule 2 at 32 keys; with both, neither rule breaks in any run. The guarantee needs one app node (or single-flight coordinated across nodes), a fetch that succeeds (a failed one must hand off to one waiting request), and TTLs jittered by 20%. Query times are illustrative.`,
  rules: [
    "Rule 1: within one app node, the database never runs more than one fetch per key at a time.",
    "Rule 2: the database's queue never holds more requests than it has workers, and no page is turned away or times out.",
  ],
  takeaways: [
    "Keys set together with the same TTL expire together, and every request in that instant misses at once.",
    "Single-flight turns many identical misses into one query per key; waiting requests take as long as that fetch.",
    "Jittered TTLs spread expiries out, so many keys don't land on the database together.",
    "Single-flight is per app node unless coordinated; serving stale data while refreshing avoids waiting altogether.",
  ],
  replays: [
    {
      args: [
        [
          { label: "no fix", ...base, singleFlight: false, jitter: 0 },
          { label: "coalesced", ...base, singleFlight: true, jitter: 0 },
          { label: "+ jitter", ...base, keys: 32, singleFlight: true, jitter: 0.2 },
        ],
        { seeds: [1, 10], rps: [200, 500, 1000], keys: [1, 4, 16, 32] },
      ],
    },
  ],
  relatedPatterns: [],
  tags: ["caching", "cache stampede", "load"],
});
