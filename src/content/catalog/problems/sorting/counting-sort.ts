import { defineProblem } from "@/lib/catalog";

export const countingSort = defineProblem({
  slug: "counting-sort",
  patternSlug: "sorting",
  title: "Sort an Array with Counting Sort",
  difficulty: "medium",
  order: 6,
  statement: `Given an array of integers \`nums\` whose values all lie between \`-50\` and \`50\` inclusive, return it sorted in ascending (non-decreasing) order. Duplicates stay in the result as many times as they appear.

This problem is about learning the algorithm, so implement counting sort yourself and don't call a built-in sort or compare elements with each other. Counting sort tallies how many times each possible value occurs, then writes the values back out in order, each repeated as many times as it was counted. Because values can be negative, shift each value by an offset to get its tally index.`,
  examples: [
    {
      input: "nums = [3, -1, 4, 1, -1, 0]",
      output: "[-1, -1, 0, 1, 3, 4]",
      explanation:
        "The tallies are -1: 2, 0: 1, 1: 1, 3: 1, 4: 1. Reading them from -50 up to 50 writes -1 twice, then 0, 1, 3, 4.",
      args: [[3, -1, 4, 1, -1, 0]],
      expected: [-1, -1, 0, 1, 3, 4],
    },
    {
      input: "nums = [50, -50]",
      output: "[-50, 50]",
      explanation: "The two ends of the range land at tally indices 100 and 0 with an offset of 50.",
      args: [[50, -50]],
      expected: [-50, 50],
    },
    {
      input: "nums = [7, 7, 7]",
      output: "[7, 7, 7]",
      explanation: "One tally of 3 at value 7.",
      args: [[7, 7, 7]],
      expected: [7, 7, 7],
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 10⁵", "-50 ≤ nums[i] ≤ 50"],
  hints: [
    "There are only 101 possible values. Instead of comparing elements, what could you record about each value?",
    "Use an array `count` of size 101 where `count[v + 50]` is how many times `v` appears.",
    "Fill the counts in one pass. Then for `k` from 0 to 100, append `k - 50` to the output `count[k]` times. The output is sorted because you visit the values in increasing order.",
  ],
  keyIdea:
    "When values come from a small range of size k, you can sort without comparisons: count each value's occurrences, then emit the values in range order. That takes O(n + k) time, which beats the O(n log n) lower bound for comparison sorts whenever k is small relative to n log n.",
  complexity: { time: "O(n + k), k = range size", space: "O(k)" },
  tags: ["array", "sorting", "counting", "non-comparison sort"],
  externalRefs: [
    { label: "LeetCode 912", url: "https://leetcode.com/problems/sort-an-array/" },
    { label: "Wikipedia: Counting sort", url: "https://en.wikipedia.org/wiki/Counting_sort" },
  ],
});
