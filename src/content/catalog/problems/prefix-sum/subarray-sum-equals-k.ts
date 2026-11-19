import { defineProblem } from "@/lib/catalog";

export const subarraySumEqualsK = defineProblem({
  slug: "subarray-sum-equals-k",
  patternSlug: "prefix-sum",
  title: "Subarray Sum Equals K",
  difficulty: "medium",
  order: 2,
  statement: `Given an integer array \`nums\` (values may be negative or zero) and an integer \`k\`, count the subarrays whose elements add up to exactly \`k\`.

A subarray is a non-empty run of adjacent elements. Two subarrays are different when they start or end at different indices, even if they contain the same values. Return the count, or \`0\` if there are none.`,
  examples: [
    {
      input: "nums = [2, 1, 3, -1, 1, 2], k = 3",
      output: "5",
      explanation: "[2, 1], [3], [1, 3, -1], [3, -1, 1], and [1, 2] each sum to 3.",
      args: [[2, 1, 3, -1, 1, 2], 3],
      expected: 5,
    },
    {
      input: "nums = [1, 1, 1, 1], k = 2",
      output: "3",
      explanation: "The pairs starting at indices 0, 1, and 2.",
      args: [[1, 1, 1, 1], 2],
      expected: 3,
    },
    {
      input: "nums = [0, 0], k = 0",
      output: "3",
      explanation: "[0] at index 0, [0] at index 1, and [0, 0] are all different subarrays.",
      args: [[0, 0], 0],
      expected: 3,
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 2 × 10⁴", "-1000 ≤ nums[i] ≤ 1000", "-10⁷ ≤ k ≤ 10⁷"],
  hints: [
    'A sliding window doesn\'t work here because negative numbers break the "grow to increase, shrink to decrease" logic. How can you express the sum of `nums[l..r]` using running totals?',
    "With prefix totals, `nums[l..r]` sums to `k` exactly when `prefix[r + 1] - prefix[l] == k`, i.e. some earlier prefix equals `prefix[r + 1] - k`.",
    "Keep a map from each prefix total seen so far to how many times it occurred, starting with `{0: 1}`. For each element, update the running sum, add `count[sum - k]` to the answer, then increment `count[sum]`.",
  ],
  keyIdea:
    "Every subarray ending at `r` is the difference between the current prefix total and some earlier one. Counting earlier prefixes equal to `sum - k` in a hash map counts all valid subarrays ending here in O(1). Seeding the map with a zero prefix covers subarrays that start at index 0.",
  complexity: { time: "O(n)", space: "O(n)" },
  tags: ["array", "prefix sum", "hash map"],
  relatedPatterns: ["arrays-hashing"],
  externalRefs: [{ label: "LeetCode 560", url: "https://leetcode.com/problems/subarray-sum-equals-k/" }],
});
