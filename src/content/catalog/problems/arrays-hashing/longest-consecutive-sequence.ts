import { defineProblem } from "@/lib/catalog";

export const longestConsecutiveSequence = defineProblem({
  slug: "longest-consecutive-sequence",
  patternSlug: "arrays-hashing",
  title: "Longest Consecutive Sequence",
  difficulty: "medium",
  order: 3,
  statement: `You are given an unsorted array of integers \`nums\`. A consecutive run is a set of values \`x, x + 1, x + 2, …, x + m - 1\` that all appear somewhere in \`nums\`, in any positions.

Return the length \`m\` of the longest such run. Repeated values count once. If \`nums\` is empty, return \`0\`. Aim for O(n) time, so sorting is not the intended solution.`,
  examples: [
    {
      input: "nums = [12, 4, 200, 1, 3, 2, 13, 11]",
      output: "4",
      explanation: "1, 2, 3, 4 is the longest run. 11, 12, 13 is shorter (3).",
      args: [[12, 4, 200, 1, 3, 2, 13, 11]],
      expected: 4,
    },
    {
      input: "nums = [7, 7, 8, 5, 6, 6]",
      output: "4",
      explanation: "The run 5, 6, 7, 8 has length 4; the duplicate 6 and 7 don't add to it.",
      args: [[7, 7, 8, 5, 6, 6]],
      expected: 4,
    },
    {
      input: "nums = []",
      output: "0",
      args: [[]],
      expected: 0,
    },
  ],
  constraints: ["0 ≤ nums.length ≤ 10⁵", "-10⁹ ≤ nums[i] ≤ 10⁹"],
  hints: [
    'Sorting makes runs easy to see but costs O(n log n). What would let you ask "is `x + 1` present?" in O(1)?',
    "Put every value in a set. Counting a run from every value repeats work. Which values are the only sensible places to start counting?",
    "Only start at `x` when `x - 1` is not in the set: `x` is the beginning of a run. From there, step `x + 1, x + 2, …` while present. Each value is visited by at most one such walk.",
  ],
  keyIdea:
    "Load the values into a set, then extend runs only from their first element (a value whose predecessor is missing). Each walk touches values that belong to that run alone, so the total work across all walks is O(n) even though there is a loop inside a loop.",
  complexity: { time: "O(n)", space: "O(n)" },
  tags: ["array", "hash set"],
  externalRefs: [
    { label: "LeetCode 128", url: "https://leetcode.com/problems/longest-consecutive-sequence/" },
  ],
});
