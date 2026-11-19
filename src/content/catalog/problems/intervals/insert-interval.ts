import { defineProblem } from "@/lib/catalog";

export const insertInterval = defineProblem({
  slug: "insert-interval",
  patternSlug: "intervals",
  title: "Insert Interval",
  difficulty: "medium",
  order: 2,
  statement: `You're given \`intervals\`, a list of closed ranges \`[start, end]\` that are already sorted by start and don't overlap each other, and one more range, \`newInterval\`.

Add \`newInterval\` to the list, merging it with every range it overlaps (sharing even a single point counts as overlapping). Return the resulting list, still sorted by start and with no overlaps.`,
  examples: [
    {
      input: "intervals = [[1, 2], [5, 7], [9, 12]], newInterval = [6, 10]",
      output: "[[1, 2], [5, 12]]",
      explanation: "[6, 10] overlaps both [5, 7] and [9, 12], so all three combine into [5, 12].",
      args: [
        [
          [1, 2],
          [5, 7],
          [9, 12],
        ],
        [6, 10],
      ],
      expected: [
        [1, 2],
        [5, 12],
      ],
    },
    {
      input: "intervals = [[2, 4], [8, 9]], newInterval = [5, 6]",
      output: "[[2, 4], [5, 6], [8, 9]]",
      explanation: "The new range fits in the gap without touching anything.",
      args: [
        [
          [2, 4],
          [8, 9],
        ],
        [5, 6],
      ],
      expected: [
        [2, 4],
        [5, 6],
        [8, 9],
      ],
    },
    {
      input: "intervals = [], newInterval = [3, 5]",
      output: "[[3, 5]]",
      args: [[], [3, 5]],
      expected: [[3, 5]],
    },
  ],
  constraints: [
    "0 ≤ intervals.length ≤ 10⁴",
    "0 ≤ start ≤ end ≤ 10⁵",
    "intervals is sorted by start and has no overlaps",
  ],
  hints: [
    "The list is already sorted, so you don't need to sort again. Which ranges can't possibly touch `newInterval`?",
    "Split the ranges into three groups: those that end before `newInterval` starts, those that overlap it, and those that start after it ends.",
    "Copy ranges with `end < newInterval.start`. Then, while a range has `start ≤ newInterval.end`, widen `newInterval` to the min start and max end. Push it, then copy the rest.",
  ],
  keyIdea:
    "Because the input is sorted and disjoint, one pass splits it into three runs: ranges entirely before the new one, ranges that overlap it, and ranges entirely after. Copy the first run, fold the overlapping run into the new range by taking the smallest start and largest end, then append the new range and the last run.",
  complexity: { time: "O(n)", space: "O(n)" },
  tags: ["array"],
  externalRefs: [{ label: "LeetCode 57", url: "https://leetcode.com/problems/insert-interval/" }],
});
