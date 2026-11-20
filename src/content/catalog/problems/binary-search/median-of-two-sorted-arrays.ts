import { defineProblem } from "@/lib/catalog";

export const medianOfTwoSortedArrays = defineProblem({
  slug: "median-of-two-sorted-arrays",
  patternSlug: "binary-search",
  title: "Median of Two Sorted Arrays",
  difficulty: "hard",
  order: 4,
  statement: `You're given two lists \`nums1\` and \`nums2\`, each sorted from smallest to largest. Return the median of all their values combined.

The median is the middle value of the combined sorted list. When the combined length is even, it's the average of the two middle values. One list may be empty, but not both.

Aim for O(log(min(m, n))) time, where \`m\` and \`n\` are the two lengths.`,
  examples: [
    {
      input: "nums1 = [5, 9, 14], nums2 = [1, 4, 10, 16]",
      output: "9",
      explanation: "Combined: [1, 4, 5, 9, 10, 14, 16]. The middle value is 9.",
      args: [
        [5, 9, 14],
        [1, 4, 10, 16],
      ],
      expected: 9,
    },
    {
      input: "nums1 = [1, 8], nums2 = [3, 5]",
      output: "4",
      explanation: "Combined: [1, 3, 5, 8]. The median is (3 + 5) / 2 = 4.",
      args: [
        [1, 8],
        [3, 5],
      ],
      expected: 4,
    },
    {
      input: "nums1 = [], nums2 = [7, 10]",
      output: "8.5",
      explanation: "Only nums2 has values, so the median is (7 + 10) / 2 = 8.5.",
      args: [[], [7, 10]],
      expected: 8.5,
    },
  ],
  judge: "float",
  constraints: [
    "0 ≤ m, n ≤ 1000 and 1 ≤ m + n",
    "-10⁶ ≤ nums1[i], nums2[i] ≤ 10⁶",
    "Both lists are sorted in non-decreasing order",
  ],
  hints: [
    "Merging the lists works in O(m + n). Instead, think about splitting the combined values into a left half and a right half without merging.",
    "If you take `i` values from the shorter list for the left half, the number taken from the other list is fixed. The split is correct when every left value is ≤ every right value.",
    "Binary search `i` over the shorter list. Compare the largest left value of each list with the smallest right value of the other to decide whether `i` is too big or too small. At the correct split, the median comes from the max of the left side and the min of the right side.",
  ],
  keyIdea:
    "Cut both lists so the left parts together hold half the values. Choosing the cut in the shorter list fixes the cut in the longer one, and the cut is valid when both left edges are ≤ both right edges. Binary search the shorter list's cut, then read the median from the values around the cuts.",
  complexity: { time: "O(log(min(m, n)))", space: "O(1)" },
  tags: ["array", "sorted", "partition"],
  externalRefs: [{ label: "LeetCode 4", url: "https://leetcode.com/problems/median-of-two-sorted-arrays/" }],
});
