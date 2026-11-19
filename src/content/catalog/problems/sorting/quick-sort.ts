import { defineProblem } from "@/lib/catalog";

export const quickSort = defineProblem({
  slug: "quick-sort",
  patternSlug: "sorting",
  title: "Sort an Array with Quick Sort",
  difficulty: "medium",
  order: 4,
  statement: `Given an array of integers \`nums\`, return it sorted in ascending (non-decreasing) order. Duplicates stay in the result as many times as they appear.

This problem is about learning the algorithm, so implement quick sort yourself and don't call a built-in sort. Quick sort picks one element as the pivot, rearranges the array so that smaller values come before the pivot and larger values after it (the partition step), and then sorts the two sides recursively. The pivot itself is already in its final place.`,
  examples: [
    {
      input: "nums = [9, 4, 7, 1, 8, 2]",
      output: "[1, 2, 4, 7, 8, 9]",
      explanation:
        "With the last element 2 as the pivot, partitioning gives [1, 2, 7, 9, 8, 4]: only 1 is smaller, so it goes left and 2 lands at index 1 for good. The right side [7, 9, 8, 4] is then sorted the same way.",
      args: [[9, 4, 7, 1, 8, 2]],
      expected: [1, 2, 4, 7, 8, 9],
    },
    {
      input: "nums = [3, 3, 1, 3]",
      output: "[1, 3, 3, 3]",
      explanation: "Many copies of the pivot value is the case a careless partition handles badly.",
      args: [[3, 3, 1, 3]],
      expected: [1, 3, 3, 3],
    },
    {
      input: "nums = [-5]",
      output: "[-5]",
      args: [[-5]],
      expected: [-5],
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 5 × 10⁴", "-5 × 10⁴ ≤ nums[i] ≤ 5 × 10⁴"],
  hints: [
    "Pick any element, the pivot. If every smaller value were to its left and every larger value to its right, what would you know about the pivot's position?",
    "Partition in place: walk the range once, keeping a boundary such that everything before it is smaller than the pivot. Each time you find a smaller value, swap it to the boundary and advance it.",
    "Lomuto partition: with `pivot = nums[hi]`, set `i = lo`; for `j` in `lo..hi-1`, if `nums[j] < pivot` swap `nums[i]`, `nums[j]` and `i++`. Swap the pivot into `i`, then recurse on `lo..i-1` and `i+1..hi`. A random pivot avoids the O(n²) worst case on sorted input.",
  ],
  keyIdea:
    "Partitioning puts the pivot in its final position with smaller values on one side and the rest on the other, in one linear pass and no extra array. If pivots split the range reasonably evenly (a random pivot does, on average), there are about log n levels of linear work: O(n log n) expected. Always splitting off a single element is the O(n²) worst case.",
  complexity: { time: "O(n log n) average, O(n²) worst", space: "O(log n) recursion" },
  tags: ["array", "sorting", "divide and conquer", "partition", "in-place"],
  relatedPatterns: ["two-pointers"],
  externalRefs: [
    { label: "LeetCode 912", url: "https://leetcode.com/problems/sort-an-array/" },
    { label: "Wikipedia: Quicksort", url: "https://en.wikipedia.org/wiki/Quicksort" },
  ],
});
