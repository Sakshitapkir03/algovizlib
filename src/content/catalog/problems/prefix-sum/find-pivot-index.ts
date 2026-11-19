import { defineProblem } from "@/lib/catalog";

export const findPivotIndex = defineProblem({
  slug: "find-pivot-index",
  patternSlug: "prefix-sum",
  title: "Find Pivot Index",
  difficulty: "easy",
  order: 0,
  statement: `Given an integer array \`nums\`, a pivot is an index \`p\` where the sum of all elements strictly to the left of \`p\` equals the sum of all elements strictly to the right of \`p\`. The element at \`p\` itself belongs to neither side, and an empty side sums to \`0\`.

Return the smallest pivot index. If no index is a pivot, return \`-1\`.`,
  examples: [
    {
      input: "nums = [3, 1, 5, 2, 2]",
      output: "2",
      explanation: "Left of index 2: 3 + 1 = 4. Right of index 2: 2 + 2 = 4.",
      args: [[3, 1, 5, 2, 2]],
      expected: 2,
    },
    {
      input: "nums = [1, 2, 4]",
      output: "-1",
      explanation: "The left/right sums are 0/6, 1/4, and 3/0. None match.",
      args: [[1, 2, 4]],
      expected: -1,
    },
    {
      input: "nums = [2, -2, 7]",
      output: "2",
      explanation: "At the last index, the left side is 2 + (-2) = 0 and the right side is empty, also 0.",
      args: [[2, -2, 7]],
      expected: 2,
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 10⁴", "-1000 ≤ nums[i] ≤ 1000"],
  hints: [
    "Recomputing both sides for every index is O(n²). What single number would let you get the right side from the left side?",
    "If you know the total and the running sum to the left of `p`, the right side is `total - left - nums[p]`.",
    "Compute `total` once. Walk left to right keeping `left`; at each index check `left == total - left - nums[p]`, return `p` on the first match, then add `nums[p]` to `left`. Return `-1` after the loop.",
  ],
  keyIdea:
    "The right-hand sum is determined by the total and the left-hand sum: `right = total - left - nums[p]`. One pass for the total and one pass with a running left sum checks every index in O(1), and scanning from the left returns the smallest pivot.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "prefix sum"],
  externalRefs: [{ label: "LeetCode 724", url: "https://leetcode.com/problems/find-pivot-index/" }],
});
