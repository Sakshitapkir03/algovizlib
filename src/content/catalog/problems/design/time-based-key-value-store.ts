import { defineProblem } from "@/lib/catalog";

export const timeBasedKeyValueStore = defineProblem({
  slug: "time-based-key-value-store",
  patternSlug: "design",
  title: "Time Based Key-Value Store",
  difficulty: "medium",
  order: 3,
  statement: `Build a store, \`TimeMap\`, that keeps every value a key has ever had, stamped with the time it was set, and can answer what a key's value was at any moment.

- \`TimeMap()\` creates an empty store.
- \`set(key: string, value: string, timestamp: number): void\` records that \`key\` had \`value\` starting at \`timestamp\`.
- \`get(key: string, timestamp: number): string\` returns the value from the \`set\` call for \`key\` with the largest timestamp that is less than or equal to \`timestamp\`. If \`key\` was never set at or before \`timestamp\`, return \`""\`.

The timestamps passed to \`set\` strictly increase across all calls.`,
  examples: [
    {
      input:
        'TimeMap, set("color", "red", 1), set("color", "teal", 4), set("color", "gold", 7), set("color", "red", 9), get("color", 6), get("color", 0), get("color", 12)',
      output: 'null, null, null, null, null, "teal", "", "red"',
      explanation:
        'At time 6 the latest change was "teal" (set at 4; "gold" only comes at 7). Nothing was set by time 0. From time 9 on the color is "red" again.',
      args: [
        ["TimeMap", "set", "set", "set", "set", "get", "get", "get"],
        [
          [],
          ["color", "red", 1],
          ["color", "teal", 4],
          ["color", "gold", 7],
          ["color", "red", 9],
          ["color", 6],
          ["color", 0],
          ["color", 12],
        ],
      ],
      expected: [null, null, null, null, null, "teal", "", "red"],
    },
    {
      input:
        'TimeMap, set("color", "red", 2), set("color", "blue", 5), get("color", 1), get("color", 2), get("color", 4), get("color", 9)',
      output: 'null, null, null, "", "red", "red", "blue"',
      explanation:
        'At time 1 nothing had been set yet. From time 2 to 4 the color was "red"; from 5 onward it is "blue".',
      args: [
        ["TimeMap", "set", "set", "get", "get", "get", "get"],
        [
          [],
          ["color", "red", 2],
          ["color", "blue", 5],
          ["color", 1],
          ["color", 2],
          ["color", 4],
          ["color", 9],
        ],
      ],
      expected: [null, null, null, "", "red", "red", "blue"],
    },
    {
      input: 'TimeMap, set("shape", "circle", 1), get("size", 3), get("shape", 1)',
      output: 'null, null, "", "circle"',
      explanation: 'A key that was never set returns "". A query at exactly the set time sees that value.',
      args: [
        ["TimeMap", "set", "get", "get"],
        [[], ["shape", "circle", 1], ["size", 3], ["shape", 1]],
      ],
      expected: [null, null, "", "circle"],
    },
  ],
  exampleFormat: "operations",
  constraints: [
    "1 ≤ key.length, value.length ≤ 100; lowercase letters and digits",
    "1 ≤ timestamp ≤ 10⁷",
    "Timestamps passed to set strictly increase",
    "At most 2 × 10⁵ calls in total",
  ],
  hints: [
    "Group the history by key. Because timestamps only increase, what do you know about each key's history list?",
    "Each key's list of `(timestamp, value)` is already sorted by time, so appending keeps it sorted.",
    'For `get`, binary search the key\'s list for the last entry with timestamp ≤ the query. Return its value, or `""` if every entry is later (or the key is missing).',
  ],
  keyIdea:
    "Map each key to a list of `(timestamp, value)` pairs. Since `set` timestamps strictly increase, appending keeps every list sorted, so `set` is O(1) and `get` is a binary search for the rightmost timestamp not after the query.",
  complexity: { time: "O(1) set, O(log n) get", space: "O(n)" },
  tags: ["design", "hash map", "binary search"],
  relatedPatterns: ["binary-search"],
  externalRefs: [{ label: "LeetCode 981", url: "https://leetcode.com/problems/time-based-key-value-store/" }],
});
