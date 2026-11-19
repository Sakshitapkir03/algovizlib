import { defineProblem } from "@/lib/catalog";

export const countInversions = defineProblem({
  slug: "count-inversions",
  patternSlug: "sorting",
  title: "Count Inversions",
  difficulty: "hard",
  order: 7,
  statement: `An inversion in an array \`nums\` is a pair of indices \`(i, j)\` with \`i < j\` and \`nums[i] > nums[j]\`: two elements that appear in the wrong order. The inversion count measures how far the array is from sorted. A sorted array has none, and an array in strictly decreasing order has the most possible.

Return the number of inversions in \`nums\`. Equal values do not form an inversion. Return \`0\` when there are none.

Checking every pair is O(n²). This problem is about learning to piggyback on merge sort: count the inversions while merging, in O(n log n).`,
  examples: [
    {
      input: "nums = [5, 2, 8, 1, 6, 3]",
      output: "8",
      explanation:
        "The inverted pairs are (5, 2), (5, 1), (5, 3), (2, 1), (8, 1), (8, 6), (8, 3), and (6, 3).",
      args: [[5, 2, 8, 1, 6, 3]],
      expected: 8,
    },
    {
      input: "nums = [4, 1, 3, 2, 5]",
      output: "4",
      explanation: "The inverted pairs are (4, 1), (4, 3), (4, 2), and (3, 2).",
      args: [[4, 1, 3, 2, 5]],
      expected: 4,
    },
    {
      input: "nums = [6, 5, 4, 3, 2, 1]",
      output: "15",
      explanation: "Strictly decreasing, so every one of the 6 × 5 / 2 = 15 pairs is inverted.",
      args: [[6, 5, 4, 3, 2, 1]],
      expected: 15,
    },
    {
      input: "nums = [2, 2, 2]",
      output: "0",
      explanation: "Equal values are not in the wrong order, so no pair counts.",
      args: [[2, 2, 2]],
      expected: 0,
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 10⁵", "-10⁹ ≤ nums[i] ≤ 10⁹"],
  hints: [
    "Split the array in half. Every inversion is either inside the left half, inside the right half, or has one element in each half. The first two kinds are the same problem, smaller.",
    "Inversions across the halves are easy to count if both halves are already sorted. When you merge and take an element from the right half, which left-half elements does it jump over?",
    "Merge sort the array. During each merge, when `right[j] < left[i]`, add `left.length - i` to the count (every remaining left element is larger) before taking `right[j]`. On ties take from the left so equal values aren't counted. Sum the counts from all merges.",
  ],
  keyIdea:
    "Merge sort already decides, for every pair split across two halves, which comes first. When the merge picks a right-half element while `k` left-half elements are still waiting, each of those `k` is larger and earlier: exactly `k` inversions. Adding those counts over all merges gives the total in O(n log n), and the array comes out sorted as a by-product.",
  complexity: { time: "O(n log n)", space: "O(n)" },
  tags: ["array", "sorting", "merge sort", "divide and conquer", "counting"],
  externalRefs: [
    {
      label: "Wikipedia: Inversion",
      url: "https://en.wikipedia.org/wiki/Inversion_(discrete_mathematics)",
    },
    { label: "Wikipedia: Merge sort", url: "https://en.wikipedia.org/wiki/Merge_sort" },
  ],
});
