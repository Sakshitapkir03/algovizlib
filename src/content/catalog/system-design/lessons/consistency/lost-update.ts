import { defineLesson } from "@/lib/catalog";

/**
 * One item's stock row at version 7 with 20 in stock. Bo sells 3 (starting at 0 ms) and Cy receives 5 (at 10 ms); each
 * spends about 40 ms between reading the row and writing it back. The right answer is 22.
 */
const base = {
  seed: 2,
  kind: "stock",
  editors: [
    { name: "Bo", startMs: 0, delta: -3 },
    { name: "Cy", startMs: 10, delta: 5 },
  ],
};

export const lostUpdate = defineLesson({
  slug: "lost-update",
  topicSlug: "consistency",
  title: "Two edits, one lost",
  kind: "incident",
  status: "available",
  symptom: "Two clerks updated the same item's stock and one person's change disappeared.",
  order: 0,
  minutes: 4,
  report: `The shop has 20 of an item in stock. Bo sells 3, and a moment later Cy receives a delivery of 5, so there should be 22.

Both see "saved". But the stock says 25: Bo's sale is gone, as if it never happened. Nobody saw an error, and the next stock count comes up 3 short.`,
  whatWentWrong: `Each clerk's screen does read → modify → write. Bo reads the row (version 7, stock 20), works out 17, and writes 17. Cy read the same version 7 a moment after Bo did, worked out 25, and writes 25.

Bo's write lands first. Then Cy's write replaces the whole row with a value computed from version 7, which didn't include Bo's sale. The database did exactly what it was told; the second write was based on stale data, and nothing checked.`,
  fix: `**Compare-and-set on the version:** each write says which version it was computed from ("write 25 if still version 7"). The database compares and writes in one atomic step: if the row is still at that version, the write applies and the version goes up; otherwise it's rejected. A rejected clerk's screen reads the row again and redoes its change on top of the new value: Cy reads version 8 (17) and writes 22.

Compare the version, not the value: a change and its reversal would look like no change at all.

Two alternatives, each with its place. An **atomic increment** ("add −3") lets the database apply the change itself with no read, ideal for counters, but it can't express edits that depend on the whole value. A **lock** makes others wait while one clerk reads, edits, and writes, which suits long read-modify-write sequences, but everyone waits, and a lock held too long stalls them all.

The cost: a clerk who loses the race has to retry, and the more people edit the same row at once, the more retries.`,
  proofScope: `The proof enumerates every interleaving of two editors' reads and writes, and of three editors', running the same row code with a scheduler that tries every choice of who moves next. With blind writes, 4 of the 6 two-editor interleavings and 84 of the 90 three-editor ones lose an edit. With compare-and-set, counting every retry, none of the 6 and none of the 498 do. The guarantee needs one database applying compare-and-set atomically on the version, each change recomputed from the value just read, and every editor retrying until its write applies. Compare-and-set prevents lost updates, but it doesn't guarantee every editor finishes quickly: under heavy contention an editor can keep losing the race (the contention sweep shows editors giving up after 10 retries). Latencies are illustrative.`,
  rules: ["Every acknowledged edit is reflected in the final value: no lost update."],
  takeaways: [
    "Read → modify → write by two people at once silently loses one edit: the later write is based on stale data.",
    "Compare-and-set on a version rejects a write computed from an old version; the writer re-reads and retries.",
    "For a counter, an atomic increment avoids the read entirely; a lock fits long edits but makes everyone wait.",
    "Retries grow with contention, and compare-and-set alone doesn't promise anyone finishes quickly.",
  ],
  replays: [
    {
      args: [
        [
          { label: "blind writes", ...base, mode: "blind" },
          { label: "the fix", ...base, mode: "compare-and-set" },
        ],
        { editors: [2, 3] },
      ],
    },
  ],
  relatedPatterns: [],
  tags: ["consistency", "concurrency", "compare-and-set"],
});
