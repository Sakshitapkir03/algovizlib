import { defineProblem } from "@/lib/catalog";

export const heapSort = defineProblem({
  slug: "heap-sort",
  patternSlug: "sorting",
  title: "Sort an Array with Heap Sort",
  difficulty: "medium",
  order: 5,
  statement: `Given an array of integers \`nums\`, return it sorted in ascending (non-decreasing) order. Duplicates stay in the result as many times as they appear.

This problem is about learning the algorithm, so implement heap sort yourself and don't call a built-in sort or a library priority queue. Heap sort first rearranges the array into a max-heap, a binary tree stored in the array where the children of index \`i\` are \`2i + 1\` and \`2i + 2\` and every parent is at least as large as its children. It then repeatedly swaps the root (the largest remaining value) to the end of the unsorted part and restores the heap on what is left.`,
  examples: [
    {
      input: "nums = [5, 13, 2, 25, 7, 17]",
      output: "[2, 5, 7, 13, 17, 25]",
      explanation:
        "Building the heap brings 25 to the root. It is swapped to the last slot, the heap is repaired so 17 rises to the root, 17 goes to the second-to-last slot, and so on.",
      args: [[5, 13, 2, 25, 7, 17]],
      expected: [2, 5, 7, 13, 17, 25],
    },
    {
      input: "nums = [10, 9, 8, 7, 6]",
      output: "[6, 7, 8, 9, 10]",
      explanation: "Descending input is already a valid max-heap, but it still needs every extraction.",
      args: [[10, 9, 8, 7, 6]],
      expected: [6, 7, 8, 9, 10],
    },
    {
      input: "nums = [1, 1]",
      output: "[1, 1]",
      args: [[1, 1]],
      expected: [1, 1],
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 5 × 10⁴", "-5 × 10⁴ ≤ nums[i] ≤ 5 × 10⁴"],
  hints: [
    "If you could always grab the largest remaining value cheaply, you could fill the array from the back. Which data structure gives you the maximum quickly?",
    "Write `siftDown(i, size)`: while a child of `i` within `size` is larger, swap `i` with its larger child and continue from there. That repairs a heap whose root is out of place.",
    "Build the heap by calling `siftDown(i, n)` for `i` from `n/2 - 1` down to 0. Then for `end` from `n - 1` down to 1: swap `nums[0]` with `nums[end]` and call `siftDown(0, end)`.",
  ],
  keyIdea:
    "A max-heap keeps the largest value at index 0 and can be repaired in O(log n) after its root changes. Building it bottom-up costs O(n); then n extractions each move the maximum to the back of the shrinking heap and sift the new root down. The result is O(n log n) in every case with O(1) extra space, though it is not stable.",
  complexity: { time: "O(n log n)", space: "O(1)" },
  tags: ["array", "sorting", "heap", "in-place"],
  relatedPatterns: ["heap"],
  externalRefs: [
    { label: "LeetCode 912", url: "https://leetcode.com/problems/sort-an-array/" },
    { label: "Wikipedia: Heapsort", url: "https://en.wikipedia.org/wiki/Heapsort" },
  ],
});
