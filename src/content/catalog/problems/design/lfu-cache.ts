import { defineProblem } from "@/lib/catalog";

export const lfuCache = defineProblem({
  slug: "lfu-cache",
  patternSlug: "design",
  title: "LFU Cache",
  difficulty: "hard",
  order: 4,
  statement: `Build a key-value cache, \`LFUCache\`, that holds at most \`capacity\` entries. Each key has a use count: it starts at \`1\` when the key is inserted, and every later \`get\` or \`put\` on that key adds \`1\`. When the cache is full and a new key arrives, it discards the key with the smallest use count; if several keys tie, it discards the one among them that was used least recently. Each method must run in O(1) average time.

- \`LFUCache(capacity: number)\` creates an empty cache. \`capacity\` may be \`0\`, in which case nothing is ever stored.
- \`get(key: number): number\` returns the value stored for \`key\`, or \`-1\` if the key is not in the cache.
- \`put(key: number, value: number): void\` stores \`value\` for \`key\`, replacing any old value. If this adds a new key and the cache already holds \`capacity\` entries, first remove the entry chosen by the rule above.`,
  examples: [
    {
      input:
        "LFUCache(2), put(7, 70), put(8, 80), get(8), put(9, 90), get(7), get(9), get(8), put(10, 100), get(9), get(10)",
      output: "null, null, null, 80, null, -1, 90, 80, null, -1, 100",
      explanation:
        "After get(8), key 7 has the lowest count (1), so put(9) evicts it. Then key 8 has count 3 and key 9 has count 2, so put(10) evicts 9.",
      args: [
        ["LFUCache", "put", "put", "get", "put", "get", "get", "get", "put", "get", "get"],
        [[2], [7, 70], [8, 80], [8], [9, 90], [7], [9], [8], [10, 100], [9], [10]],
      ],
      expected: [null, null, null, 80, null, -1, 90, 80, null, -1, 100],
    },
    {
      input: "LFUCache(2), put(1, 5), put(2, 6), put(3, 7), get(1), get(2)",
      output: "null, null, null, null, -1, 6",
      explanation: "Keys 1 and 2 both have count 1. Key 1 was used longer ago, so it is the one evicted.",
      args: [
        ["LFUCache", "put", "put", "put", "get", "get"],
        [[2], [1, 5], [2, 6], [3, 7], [1], [2]],
      ],
      expected: [null, null, null, null, -1, 6],
    },
    {
      input: "LFUCache(0), put(1, 1), get(1)",
      output: "null, null, -1",
      explanation: "A cache with capacity 0 can't store anything.",
      args: [
        ["LFUCache", "put", "get"],
        [[0], [1, 1], [1]],
      ],
      expected: [null, null, -1],
    },
  ],
  exampleFormat: "operations",
  constraints: [
    "0 ≤ capacity ≤ 10⁴",
    "0 ≤ key ≤ 10⁵, 0 ≤ value ≤ 10⁹",
    "At most 2 × 10⁵ calls to get and put",
  ],
  hints: [
    "Within one use count, the tie-break is exactly LRU. How could you keep a separate recency list per count?",
    "Group keys into buckets by count, each bucket ordered by recency. Using a key moves it from bucket `c` to bucket `c + 1`. How do you find the bucket to evict from without scanning?",
    "Keep a map from key to `(value, count)`, a map from count to an insertion-ordered set (or doubly linked list) of keys, and a `minCount`. On use, move the key up one bucket and bump `minCount` if its old bucket was the minimum and is now empty. On insert, evict the oldest key in bucket `minCount`, then add the new key with count 1 and set `minCount = 1`.",
  ],
  keyIdea:
    "Bucket keys by use count, and keep each bucket in recency order so it behaves like a small LRU list. A key's count only ever rises by one, so the minimum count can be tracked directly: it resets to 1 on every insert and goes up by one only when the minimum bucket empties during a use. Eviction then removes the oldest key of the minimum bucket in O(1).",
  complexity: { time: "O(1) per operation", space: "O(capacity)" },
  tags: ["design", "hash map", "linked list", "cache"],
  relatedPatterns: ["linked-list", "arrays-hashing"],
  externalRefs: [{ label: "LeetCode 460", url: "https://leetcode.com/problems/lfu-cache/" }],
});
