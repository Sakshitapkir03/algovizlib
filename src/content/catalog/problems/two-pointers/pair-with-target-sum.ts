import { defineProblem } from "@/lib/catalog";

export const pairWithTargetSum = defineProblem({
  slug: "pair-with-target-sum",
  patternSlug: "two-pointers",
  title: "Pair with Target Sum",
  difficulty: "easy",
  order: 0,
  statement: `You're given a list of numbers \`nums\` sorted from smallest to largest, and a number \`target\`. Find two different positions whose values add up to exactly \`target\`, and return those two positions (0-based, smaller first).

Each input has at most one such pair. If no pair adds up to \`target\`, return an empty list.`,
  examples: [
    {
      input: "nums = [4, 9, 14, 21, 28, 36, 45], target = 50",
      output: "[2, 5]",
      explanation: "nums[2] + nums[5] = 14 + 36 = 50.",
      args: [[4, 9, 14, 21, 28, 36, 45], 50],
      expected: [2, 5],
    },
    {
      input: "nums = [1, 3, 5, 8], target = 9",
      output: "[0, 3]",
      explanation: "1 + 8 = 9.",
      args: [[1, 3, 5, 8], 9],
      expected: [0, 3],
    },
    {
      input: "nums = [2, 4, 6], target = 5",
      output: "[]",
      explanation: "Every pair sums to an even number, so none can reach 5.",
      args: [[2, 4, 6], 5],
      expected: [],
    },
  ],
  constraints: [
    "2 ≤ nums.length ≤ 10⁵",
    "-10⁹ ≤ nums[i], target ≤ 10⁹",
    "nums is sorted in non-decreasing order",
  ],
  hints: [
    "Checking every pair works, but it's O(n²). What does the sorted order let you skip?",
    "Start with the smallest and the largest value. If their sum is too small, which one can never be part of the answer?",
    "Keep one index at each end. Too small: move the left index right. Too big: move the right index left. Equal: done.",
  ],
  keyIdea:
    "Put one pointer at each end. Because the list is sorted, a sum that's too small means the left value can't pair with anything remaining, so move it right; a sum that's too big rules out the right value, so move it left. Each step discards one candidate, so you finish in one pass.",
  complexity: { time: "O(n)", space: "O(1)" },
  storyboardId: "two-pointers",
  tags: ["array", "sorted"],
  externalRefs: [
    { label: "LeetCode 167", url: "https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/" },
  ],
});
