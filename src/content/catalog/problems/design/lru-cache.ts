import { defineProblem } from "@/lib/catalog";

export const lruCache = defineProblem({
  slug: "lru-cache",
  patternSlug: "design",
  title: "LRU Cache",
  difficulty: "medium",
  order: 2,
  statement: `Build a key-value cache, \`LRUCache\`, that holds at most \`capacity\` entries. When it is full and a new key arrives, it discards the entry that was used least recently. Both \`get\` and \`put\` count as using a key. Each method must run in O(1) average time.

- \`LRUCache(capacity: number)\` creates an empty cache with the given positive capacity.
- \`get(key: number): number\` returns the value stored for \`key\`, or \`-1\` if the key is not in the cache.
- \`put(key: number, value: number): void\` stores \`value\` for \`key\`, replacing any old value. If this adds a new key and the cache already holds \`capacity\` entries, first remove the least recently used entry.`,
  examples: [
    {
      input:
        "LRUCache(2), put(1, 10), put(2, 20), get(1), put(3, 30), get(2), put(4, 40), get(1), get(3), get(4)",
      output: "null, null, null, 10, null, -1, null, -1, 30, 40",
      explanation:
        "Reading key 1 makes key 2 the stalest, so put(3) evicts 2. Then key 1 is the stalest, so put(4) evicts 1. Keys 3 and 4 remain.",
      args: [
        ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
        [[2], [1, 10], [2, 20], [1], [3, 30], [2], [4, 40], [1], [3], [4]],
      ],
      expected: [null, null, null, 10, null, -1, null, -1, 30, 40],
    },
    {
      input: "LRUCache(1), put(5, 50), put(5, 55), get(5), put(6, 60), get(5)",
      output: "null, null, null, 55, null, -1",
      explanation:
        "Putting an existing key updates it without evicting anything. With capacity 1, adding key 6 evicts key 5.",
      args: [
        ["LRUCache", "put", "put", "get", "put", "get"],
        [[1], [5, 50], [5, 55], [5], [6, 60], [5]],
      ],
      expected: [null, null, null, 55, null, -1],
    },
  ],
  exampleFormat: "operations",
  constraints: [
    "1 ≤ capacity ≤ 3000",
    "0 ≤ key ≤ 10⁴, 0 ≤ value ≤ 10⁵",
    "At most 2 × 10⁵ calls to get and put",
  ],
  hints: [
    "You need two things fast: finding a key, and knowing which key was used longest ago. Which structure gives each?",
    "Keep the entries in a list ordered by last use. Using a key moves it to the front; eviction removes from the back. How do you move a node in O(1)?",
    "Combine a hash map from key to node with a doubly linked list (sentinel head and tail). `get` and `put` unlink the node and reinsert it at the front; on overflow, remove the node before the tail and delete its key from the map.",
  ],
  keyIdea:
    "A hash map finds a key's entry in O(1), and a doubly linked list keeps entries in recency order with O(1) unlink and insert at a known node. Storing the list nodes in the map links the two: every access moves the node to the front, and eviction takes the node at the back. (In JavaScript a `Map`, which keeps insertion order, can play both roles by deleting and re-inserting on each use.)",
  complexity: { time: "O(1) per operation", space: "O(capacity)" },
  tags: ["design", "hash map", "linked list", "cache"],
  relatedPatterns: ["linked-list", "arrays-hashing"],
  externalRefs: [{ label: "LeetCode 146", url: "https://leetcode.com/problems/lru-cache/" }],
});
