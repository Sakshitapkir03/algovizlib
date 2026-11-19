import { defineProblem } from "@/lib/catalog";

export const selectionSort = defineProblem({
  slug: "selection-sort",
  patternSlug: "sorting",
  title: "Sort an Array with Selection Sort",
  difficulty: "easy",
  order: 1,
  statement: `Given an array of integers \`nums\`, return it sorted in ascending (non-decreasing) order. Duplicates stay in the result as many times as they appear.

This problem is about learning the algorithm, so implement selection sort yourself and don't call a built-in sort. Selection sort grows a sorted prefix from the left: on each step it scans the unsorted part for its smallest value and swaps that value into the first unsorted position.`,
  examples: [
    {
      input: "nums = [5, 2, 8, 1, 6]",
      output: "[1, 2, 5, 6, 8]",
      explanation:
        "Round 1 scans for the smallest value, 1, and swaps it with 5. Round 2 finds 2 already in place. Round 3 swaps 5 into index 2, and round 4 swaps 6 into index 3.",
      args: [[5, 2, 8, 1, 6]],
      expected: [1, 2, 5, 6, 8],
    },
    {
      input: "nums = [12, -4, 0, 7, 3]",
      output: "[-4, 0, 3, 7, 12]",
      explanation:
        "Step 1 finds -4 and swaps it with 12: [-4, 12, 0, 7, 3]. Step 2 finds 0 and swaps it into index 1, and so on.",
      args: [[12, -4, 0, 7, 3]],
      expected: [-4, 0, 3, 7, 12],
    },
    {
      input: "nums = [9, 8, 7, 6]",
      output: "[6, 7, 8, 9]",
      explanation: "Reverse order still takes exactly one swap per position.",
      args: [[9, 8, 7, 6]],
      expected: [6, 7, 8, 9],
    },
    {
      input: "nums = [5, 5, 5]",
      output: "[5, 5, 5]",
      explanation: "All values are equal, so every minimum is already in place.",
      args: [[5, 5, 5]],
      expected: [5, 5, 5],
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 1000", "-10⁴ ≤ nums[i] ≤ 10⁴"],
  hints: [
    "Which value belongs at index 0 of the sorted array? How do you find it?",
    "Once index 0 holds the smallest value, the rest of the array is the same problem, one element shorter.",
    "For each `i` from 0 to n - 2, scan `i..n-1` for the index of the smallest value, then swap it with `nums[i]`.",
  ],
  keyIdea:
    "Keep `nums[0..i-1]` sorted and holding the i smallest values. Scanning the rest for its minimum and swapping it into position `i` extends that prefix by one. It always does about n²/2 comparisons but at most n - 1 swaps, which is why it is used when writes are expensive.",
  complexity: { time: "O(n²)", space: "O(1)" },
  tags: ["array", "sorting", "in-place"],
  externalRefs: [
    { label: "LeetCode 912", url: "https://leetcode.com/problems/sort-an-array/" },
    { label: "Wikipedia: Selection sort", url: "https://en.wikipedia.org/wiki/Selection_sort" },
  ],
});
