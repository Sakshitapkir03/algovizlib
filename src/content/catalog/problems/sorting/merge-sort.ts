import { defineProblem } from "@/lib/catalog";

export const mergeSort = defineProblem({
  slug: "merge-sort",
  patternSlug: "sorting",
  title: "Sort an Array with Merge Sort",
  difficulty: "medium",
  order: 3,
  statement: `Given an array of integers \`nums\`, return it sorted in ascending (non-decreasing) order. Duplicates stay in the result as many times as they appear.

This problem is about learning the algorithm, so implement merge sort yourself and don't call a built-in sort. Merge sort splits the array into two halves, sorts each half recursively, and then merges the two sorted halves into one sorted array by repeatedly taking the smaller of their front elements.`,
  examples: [
    {
      input: "nums = [15, 3, 11, 8, 1, 6]",
      output: "[1, 3, 6, 8, 11, 15]",
      explanation:
        "The halves [15, 3, 11] and [8, 1, 6] sort to [3, 11, 15] and [1, 6, 8]. Merging takes 1, 3, 6, 8, 11, 15 from their fronts.",
      args: [[15, 3, 11, 8, 1, 6]],
      expected: [1, 3, 6, 8, 11, 15],
    },
    {
      input: "nums = [4, -2, 4, 0]",
      output: "[-2, 0, 4, 4]",
      explanation: "[4, -2] → [-2, 4] and [4, 0] → [0, 4]; merging gives [-2, 0, 4, 4].",
      args: [[4, -2, 4, 0]],
      expected: [-2, 0, 4, 4],
    },
    {
      input: "nums = [5]",
      output: "[5]",
      explanation: "An array of one element is the base case: it is already sorted.",
      args: [[5]],
      expected: [5],
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 5 × 10⁴", "-5 × 10⁴ ≤ nums[i] ≤ 5 × 10⁴"],
  hints: [
    "If someone handed you two arrays that were already sorted, how fast could you combine them into one sorted array?",
    "Split the array in half until each piece has one element. A one-element piece is sorted, so now you only need merges.",
    "Write `merge(left, right)` with two indices that copy the smaller front element (the left one on ties) into the output, then append whatever remains. `sort(a)` returns `a` when its length ≤ 1, otherwise `merge(sort(a[0..mid)), sort(a[mid..]))`.",
  ],
  keyIdea:
    "Merging two sorted arrays takes linear time because the smallest remaining value is always at one of the two fronts. Halving the array gives log n levels, and each level merges n elements in total, so the whole sort is O(n log n) in every case. Taking from the left half on ties keeps it stable.",
  complexity: { time: "O(n log n)", space: "O(n)" },
  tags: ["array", "sorting", "divide and conquer", "recursion", "stable"],
  externalRefs: [
    { label: "LeetCode 912", url: "https://leetcode.com/problems/sort-an-array/" },
    { label: "Wikipedia: Merge sort", url: "https://en.wikipedia.org/wiki/Merge_sort" },
  ],
});
