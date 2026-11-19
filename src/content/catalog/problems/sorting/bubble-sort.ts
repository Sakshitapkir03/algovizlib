import { defineProblem } from "@/lib/catalog";

export const bubbleSort = defineProblem({
  slug: "bubble-sort",
  patternSlug: "sorting",
  title: "Sort an Array with Bubble Sort",
  difficulty: "easy",
  order: 0,
  statement: `Given an array of integers \`nums\`, return it sorted in ascending (non-decreasing) order. Duplicates stay in the result as many times as they appear.

This problem is about learning the algorithm, so implement bubble sort yourself and don't call a built-in sort. Bubble sort walks through the array comparing each pair of neighbors and swaps them when the left one is larger. After each full pass, the largest value not yet in place has "bubbled" to the end, so the next pass can stop one position earlier.`,
  examples: [
    {
      input: "nums = [7, 3, 9, 1, 4]",
      output: "[1, 3, 4, 7, 9]",
      explanation:
        "The first pass carries 9 to the end: [3, 7, 1, 4, 9]. The second carries 7 next to it, and so on until no swaps are needed.",
      args: [[7, 3, 9, 1, 4]],
      expected: [1, 3, 4, 7, 9],
    },
    {
      input: "nums = [2, 8, 2, 5, -1]",
      output: "[-1, 2, 2, 5, 8]",
      explanation: "Both 2s are kept, and the negative value ends up first.",
      args: [[2, 8, 2, 5, -1]],
      expected: [-1, 2, 2, 5, 8],
    },
    {
      input: "nums = [42]",
      output: "[42]",
      explanation: "A single element is already sorted; there are no neighbors to compare.",
      args: [[42]],
      expected: [42],
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 1000", "-10⁴ ≤ nums[i] ≤ 10⁴"],
  hints: [
    "Compare only neighbors: `nums[j]` and `nums[j + 1]`. What should happen when they are out of order?",
    "After one full left-to-right pass of swaps, where is the largest value guaranteed to be?",
    "Run passes `i = 0, 1, …`; in pass `i`, compare neighbors up to index `n - 2 - i` and swap when the left is bigger. If a pass makes no swaps, the array is sorted and you can stop early.",
  ],
  keyIdea:
    "Each pass swaps out-of-order neighbors, which pushes the largest unsorted value to the end of the unsorted part. After `i` passes the last `i` positions are final, so at most n - 1 passes are needed, and a pass with no swaps means you can stop early (O(n) on already-sorted input).",
  complexity: { time: "O(n²)", space: "O(1)" },
  tags: ["array", "sorting", "in-place"],
  externalRefs: [
    { label: "LeetCode 912", url: "https://leetcode.com/problems/sort-an-array/" },
    { label: "Wikipedia: Bubble sort", url: "https://en.wikipedia.org/wiki/Bubble_sort" },
  ],
});
