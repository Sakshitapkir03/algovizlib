import { defineProblem } from "@/lib/catalog";

export const nonOverlappingIntervals = defineProblem({
  slug: "non-overlapping-intervals",
  patternSlug: "intervals",
  title: "Non-overlapping Intervals",
  difficulty: "medium",
  order: 3,
  statement: `You're given a list of ranges, \`intervals\`, where \`intervals[i] = [start, end]\` and \`start < end\`. Two ranges overlap if one starts strictly before the other ends; ranges that only touch, like \`[1, 3]\` and \`[3, 5]\`, don't overlap.

Return the smallest number of ranges you must remove so that none of the remaining ranges overlap. Return \`0\` if they already don't.`,
  examples: [
    {
      input: "intervals = [[1, 4], [2, 3], [3, 6], [5, 7]]",
      output: "2",
      explanation:
        "Keeping [2, 3] and [3, 6] (or [2, 3] and [5, 7]) means removing two. No three of these ranges can coexist.",
      args: [
        [
          [1, 4],
          [2, 3],
          [3, 6],
          [5, 7],
        ],
      ],
      expected: 2,
    },
    {
      input: "intervals = [[0, 2], [2, 4], [4, 6]]",
      output: "0",
      explanation: "Each range only touches the next, so nothing overlaps.",
      args: [
        [
          [0, 2],
          [2, 4],
          [4, 6],
        ],
      ],
      expected: 0,
    },
    {
      input: "intervals = [[3, 5], [3, 5], [3, 5]]",
      output: "2",
      explanation: "Identical ranges overlap each other, so only one can stay.",
      args: [
        [
          [3, 5],
          [3, 5],
          [3, 5],
        ],
      ],
      expected: 2,
    },
  ],
  constraints: ["1 ≤ intervals.length ≤ 10⁵", "-5·10⁴ ≤ start < end ≤ 5·10⁴"],
  hints: [
    "Removing as few as possible is the same as keeping as many non-overlapping ranges as possible.",
    "If you're choosing the first range to keep, which one leaves the most room for everything after it?",
    "Sort by end. Keep the first range, then keep each next range whose start is at least the last kept end; every other range is removed. Count the removals.",
  ],
  keyIdea:
    "Minimizing removals means maximizing the ranges kept. Sort by end and greedily keep a range whenever it starts at or after the end of the last kept one. Keeping the range that finishes earliest never hurts, because any other choice ends later and blocks at least as much of what follows.",
  complexity: { time: "O(n log n)", space: "O(1) beyond the sort" },
  tags: ["array", "sorting", "greedy"],
  relatedPatterns: ["greedy"],
  externalRefs: [{ label: "LeetCode 435", url: "https://leetcode.com/problems/non-overlapping-intervals/" }],
});
