import { defineProblem } from "@/lib/catalog";

export const subsets = defineProblem({
  slug: "subsets",
  patternSlug: "backtracking",
  title: "Subsets",
  difficulty: "medium",
  order: 1,
  statement: `Given an array \`nums\` of distinct integers, return every possible subset of it (its power set), including the empty subset and \`nums\` itself.

Each subset must appear exactly once. You may return the subsets in any order, and the numbers inside each subset in any order.`,
  examples: [
    {
      input: "nums = [5, 1, 8]",
      output: "[[], [5], [1], [8], [5, 1], [5, 8], [1, 8], [5, 1, 8]]",
      explanation: "Three distinct numbers give 2³ = 8 subsets.",
      args: [[5, 1, 8]],
      expected: [[], [5], [1], [8], [5, 1], [5, 8], [1, 8], [5, 1, 8]],
    },
    {
      input: "nums = [0]",
      output: "[[], [0]]",
      explanation: "A single number is either left out or taken.",
      args: [[0]],
      expected: [[], [0]],
    },
  ],
  judge: "unordered-nested",
  constraints: ["1 ≤ nums.length ≤ 10", "-10 ≤ nums[i] ≤ 10", "all values in nums are distinct"],
  hints: [
    "For each number there are exactly two choices: it's in the subset or it isn't.",
    "Keep one list `current` and recurse over the indices. At index `i`, explore the branch that adds `nums[i]` and the branch that doesn't.",
    "`dfs(i)`: if `i == n`, save a copy of `current`. Otherwise push `nums[i]`, call `dfs(i + 1)`, pop it, and call `dfs(i + 1)` again.",
  ],
  keyIdea:
    "Walk the indices in order and branch on include or exclude, using one shared list that you push to before the include branch and pop from after it. Each leaf of this binary decision tree is a distinct subset, and there are exactly 2ⁿ leaves; copying the list at each leaf costs up to n.",
  complexity: { time: "O(n · 2ⁿ)", space: "O(n) besides the output" },
  tags: ["array", "subsets", "recursion"],
  relatedPatterns: ["bit-manipulation"],
  externalRefs: [{ label: "LeetCode 78", url: "https://leetcode.com/problems/subsets/" }],
});
