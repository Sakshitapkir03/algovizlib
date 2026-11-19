import { defineProblem } from "@/lib/catalog";

export const twoSum = defineProblem({
  slug: "two-sum",
  patternSlug: "arrays-hashing",
  title: "Two Sum",
  difficulty: "easy",
  order: 0,
  statement: `You are given an unsorted array of integers \`nums\` and an integer \`target\`. Exactly one pair of different positions \`i\` and \`j\` has \`nums[i] + nums[j] == target\`.

Return that pair as \`[i, j]\` with \`i < j\`. The same position can't be used twice, but two positions may hold equal values.`,
  examples: [
    {
      input: "nums = [8, 3, 11, 6, 2], target = 9",
      output: "[1, 3]",
      explanation: "nums[1] + nums[3] = 3 + 6 = 9.",
      args: [[8, 3, 11, 6, 2], 9],
      expected: [1, 3],
    },
    {
      input: "nums = [-4, 11, 7, -1], target = 6",
      output: "[2, 3]",
      explanation: "7 + (-1) = 6. Negative numbers work the same way.",
      args: [[-4, 11, 7, -1], 6],
      expected: [2, 3],
    },
    {
      input: "nums = [5, 5], target = 10",
      output: "[0, 1]",
      explanation: "Two different positions holding the same value are a valid pair.",
      args: [[5, 5], 10],
      expected: [0, 1],
    },
  ],
  constraints: ["2 ≤ nums.length ≤ 10⁴", "-10⁹ ≤ nums[i], target ≤ 10⁹", "Exactly one valid pair exists"],
  hints: [
    "Checking every pair works but is O(n²). For a fixed `nums[j]`, which single value would complete the pair?",
    "The partner of `nums[j]` is `target - nums[j]`. You need a fast way to ask whether that value appeared earlier, and where.",
    "Walk left to right with a map from value to index. Before storing `nums[j]`, look up `target - nums[j]`; if it is there at index `i`, return `[i, j]`.",
  ],
  keyIdea:
    "Each number has exactly one complement, `target - nums[j]`. Scan once, keeping a map from each value seen so far to its index. Looking up the complement before inserting the current value finds the earlier position in O(1), so the pair comes out as `[i, j]` with `i < j`, and an element never pairs with itself.",
  complexity: { time: "O(n)", space: "O(n)" },
  tags: ["array", "hash map"],
  externalRefs: [{ label: "LeetCode 1", url: "https://leetcode.com/problems/two-sum/" }],
});
