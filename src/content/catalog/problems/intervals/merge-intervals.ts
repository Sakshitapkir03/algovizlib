import { defineProblem } from "@/lib/catalog";

export const mergeIntervals = defineProblem({
  slug: "merge-intervals",
  patternSlug: "intervals",
  title: "Merge Intervals",
  difficulty: "medium",
  order: 1,
  statement: `You're given a non-empty list of closed ranges, \`intervals\`, where \`intervals[i] = [start, end]\` and \`start ≤ end\`. The list isn't sorted, and ranges may overlap.

Combine every group of overlapping ranges into one range that covers them all. Two ranges overlap if they share at least one point, so \`[2, 5]\` and \`[5, 8]\` merge into \`[2, 8]\`.

Return the merged ranges sorted by start. No two returned ranges overlap.`,
  examples: [
    {
      input: "intervals = [[4, 7], [1, 3], [6, 9], [12, 14]]",
      output: "[[1, 3], [4, 9], [12, 14]]",
      explanation: "[4, 7] and [6, 9] overlap on 6–7, so they become [4, 9]. The others stand alone.",
      args: [
        [
          [4, 7],
          [1, 3],
          [6, 9],
          [12, 14],
        ],
      ],
      expected: [
        [1, 3],
        [4, 9],
        [12, 14],
      ],
    },
    {
      input: "intervals = [[2, 5], [5, 8]]",
      output: "[[2, 8]]",
      explanation: "The ranges share the point 5, which counts as overlapping.",
      args: [
        [
          [2, 5],
          [5, 8],
        ],
      ],
      expected: [[2, 8]],
    },
    {
      input: "intervals = [[3, 10], [4, 6]]",
      output: "[[3, 10]]",
      explanation: "[4, 6] sits entirely inside [3, 10], so the merged end stays 10.",
      args: [
        [
          [3, 10],
          [4, 6],
        ],
      ],
      expected: [[3, 10]],
    },
  ],
  constraints: ["1 ≤ intervals.length ≤ 10⁴", "0 ≤ start ≤ end ≤ 10⁴"],
  hints: [
    "If the ranges were sorted by start, where would the ranges that overlap a given range appear?",
    "After sorting, keep the range you're currently building. Does the next range overlap it, and if so, what's the new end? Watch out for a range that sits completely inside.",
    "Sort by start. For each range, if its start is at most the last merged range's end, set that end to `max(end, range.end)`; otherwise push it as a new merged range.",
  ],
  keyIdea:
    "Sort by start so that overlapping ranges become neighbours. Sweep once, keeping the last merged range: a range that starts at or before its end extends it (taking the larger end), and a range that starts after it begins a new one.",
  complexity: { time: "O(n log n)", space: "O(n)" },
  tags: ["array", "sorting"],
  externalRefs: [{ label: "LeetCode 56", url: "https://leetcode.com/problems/merge-intervals/" }],
});
