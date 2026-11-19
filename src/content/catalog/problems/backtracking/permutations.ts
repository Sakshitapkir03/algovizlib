import { defineProblem } from "@/lib/catalog";

export const permutations = defineProblem({
  slug: "permutations",
  patternSlug: "backtracking",
  title: "Permutations",
  difficulty: "medium",
  order: 2,
  statement: `Given an array \`nums\` of distinct integers, return every possible ordering (permutation) of all its elements.

Each permutation must appear exactly once. You may return the permutations in any order, but the order of numbers inside each permutation is the permutation itself, so it matters.`,
  examples: [
    {
      input: "nums = [3, 6, 9]",
      output: "[[3, 6, 9], [3, 9, 6], [6, 3, 9], [6, 9, 3], [9, 3, 6], [9, 6, 3]]",
      explanation: "Three choices for the first slot, two for the second, one for the last: 3! = 6.",
      args: [[3, 6, 9]],
      expected: [
        [3, 6, 9],
        [3, 9, 6],
        [6, 3, 9],
        [6, 9, 3],
        [9, 3, 6],
        [9, 6, 3],
      ],
    },
    {
      input: "nums = [-2, 4]",
      output: "[[-2, 4], [4, -2]]",
      args: [[-2, 4]],
      expected: [
        [-2, 4],
        [4, -2],
      ],
    },
    {
      input: "nums = [7]",
      output: "[[7]]",
      explanation: "One number has exactly one ordering.",
      args: [[7]],
      expected: [[7]],
    },
  ],
  judge: "unordered",
  constraints: ["1 ≤ nums.length ≤ 6", "-10 ≤ nums[i] ≤ 10", "all values in nums are distinct"],
  hints: [
    "Build a permutation one slot at a time. What can go in the next slot?",
    "Any number not already used can go next. Track which numbers are in the current partial permutation with a `used` array.",
    "`dfs()`: if `current` has `n` numbers, save a copy. Otherwise for each unused `nums[i]`: mark it used, push it, recurse, then pop it and unmark it.",
  ],
  keyIdea:
    "Fill positions left to right. At each level, try every number that isn't used yet: mark it, append it, recurse to fill the next position, then undo both. The decision tree has n choices at the first level, n - 1 at the next, and so on, giving exactly n! leaves, each a distinct permutation.",
  complexity: { time: "O(n · n!)", space: "O(n) besides the output" },
  tags: ["array", "permutations", "recursion"],
  externalRefs: [{ label: "LeetCode 46", url: "https://leetcode.com/problems/permutations/" }],
});
