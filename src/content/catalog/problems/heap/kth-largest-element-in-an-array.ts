import { defineProblem } from "@/lib/catalog";

export const kthLargestElementInAnArray = defineProblem({
  slug: "kth-largest-element-in-an-array",
  patternSlug: "heap",
  title: "Kth Largest Element in an Array",
  difficulty: "medium",
  order: 1,
  statement: `Given an integer array \`nums\` and an integer \`k\`, return the value that would sit at position \`k\` if \`nums\` were sorted from largest to smallest (counting from 1).

Duplicates count separately: in \`[5, 5, 2]\` the 1st and 2nd largest are both \`5\`. Try to do better than sorting the whole array.`,
  examples: [
    {
      input: "nums = [7, 2, 9, 4, 9, 1], k = 2",
      output: "9",
      explanation: "From largest to smallest: 9, 9, 7, 4, 2, 1. The 2nd value is the second 9.",
      args: [[7, 2, 9, 4, 9, 1], 2],
      expected: 9,
    },
    {
      input: "nums = [5, 3, 8, 6, 1], k = 4",
      output: "3",
      explanation: "Sorted descending: 8, 6, 5, 3, 1. The 4th value is 3.",
      args: [[5, 3, 8, 6, 1], 4],
      expected: 3,
    },
    {
      input: "nums = [-6], k = 1",
      output: "-6",
      explanation: "With one element, it is the largest.",
      args: [[-6], 1],
      expected: -6,
    },
  ],
  constraints: ["1 ≤ k ≤ nums.length ≤ 10⁵", "-10⁴ ≤ nums[i] ≤ 10⁴"],
  hints: [
    "Sorting answers it in O(n log n), but you only care about the top k values, not the order of everything.",
    "Imagine keeping only the k largest values seen so far. Which of those k is the one at risk of being pushed out by a new value?",
    "Keep a min-heap of size k. Push each number; if the heap grows past k, pop its smallest. At the end the heap's root is the kth largest.",
  ],
  keyIdea:
    "A min-heap holding the k largest values seen so far has the weakest of them at its root. A new value only matters if it beats that root, and after the scan the root is exactly the kth largest. Each step costs O(log k).",
  complexity: { time: "O(n log k)", space: "O(k)" },
  tags: ["array", "heap", "quickselect"],
  externalRefs: [
    { label: "LeetCode 215", url: "https://leetcode.com/problems/kth-largest-element-in-an-array/" },
  ],
});
