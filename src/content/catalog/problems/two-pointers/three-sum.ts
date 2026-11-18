import { defineProblem } from "@/lib/catalog";

export const threeSum = defineProblem({
  slug: "three-sum",
  patternSlug: "two-pointers",
  title: "Three Sum",
  difficulty: "medium",
  order: 3,
  statement: `You're given an unsorted array of integers \`nums\`. Find every group of three values, taken from three different positions, that adds up to \`0\`.

Return each distinct group once, as a list of three values. Two groups are the same if they contain the same values, so the list must not contain duplicates. The groups, and the values inside each group, may be returned in any order. If no group sums to \`0\`, return an empty list.`,
  examples: [
    {
      input: "nums = [-3, 1, 2, 0, -1, 4, -2]",
      output: "[[-3, -1, 4], [-3, 1, 2], [-2, 0, 2], [-1, 0, 1]]",
      args: [[-3, 1, 2, 0, -1, 4, -2]],
      expected: [
        [-3, -1, 4],
        [-3, 1, 2],
        [-2, 0, 2],
        [-1, 0, 1],
      ],
    },
    {
      input: "nums = [-2, 1, 1, -2, 4, 0]",
      output: "[[-2, -2, 4], [-2, 1, 1]]",
      explanation: "The value -2 appears twice, but each distinct group is listed only once.",
      args: [[-2, 1, 1, -2, 4, 0]],
      expected: [
        [-2, -2, 4],
        [-2, 1, 1],
      ],
    },
    {
      input: "nums = [0, 0, 0, 0]",
      output: "[[0, 0, 0]]",
      explanation: "Several position choices give 0 + 0 + 0, but they're all the same group.",
      args: [[0, 0, 0, 0]],
      expected: [[0, 0, 0]],
    },
  ],
  judge: "unordered-nested",
  constraints: ["3 ≤ nums.length ≤ 3000", "-10⁵ ≤ nums[i] ≤ 10⁵"],
  hints: [
    "If you fix one of the three values, what's left is a familiar two-value problem.",
    "Sorting the array first lets you solve that two-value problem with a pointer at each end, and puts equal values next to each other.",
    "Sort. For each index i, look for pairs to its right summing to -nums[i] with left/right pointers. Skip a value equal to the previous one, both for i and after recording a match, so no group repeats.",
  ],
  keyIdea:
    "Sort the array, then fix each value in turn as the smallest member of the group. The remaining two must sum to its negation, which a left and right pointer over the rest of the sorted array find in one pass. Skipping over repeated values keeps every group unique without needing a set.",
  complexity: { time: "O(n²)", space: "O(1) extra, not counting the output and sort" },
  tags: ["array", "sorting"],
  externalRefs: [{ label: "LeetCode 15", url: "https://leetcode.com/problems/3sum/" }],
});
