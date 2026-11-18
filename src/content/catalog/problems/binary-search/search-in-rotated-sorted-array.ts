import { defineProblem } from "@/lib/catalog";

export const searchInRotatedSortedArray = defineProblem({
  slug: "search-in-rotated-sorted-array",
  patternSlug: "binary-search",
  title: "Search in Rotated Sorted Array",
  difficulty: "medium",
  order: 2,
  statement: `A list of distinct numbers was sorted from smallest to largest, then rotated: some prefix was cut off and moved to the end. For example, \`[3, 8, 12, 17, 22, 27, 31]\` could become \`[22, 27, 31, 3, 8, 12, 17]\`. The rotation might also be zero, leaving the list fully sorted.

Given the rotated list \`nums\` and a number \`target\`, return the position (0-based) of \`target\` in \`nums\`, or \`-1\` if it isn't there. Aim for O(log n) time.`,
  examples: [
    {
      input: "nums = [22, 27, 31, 3, 8, 12, 17], target = 8",
      output: "4",
      explanation: "nums[4] = 8.",
      args: [[22, 27, 31, 3, 8, 12, 17], 8],
      expected: 4,
    },
    {
      input: "nums = [22, 27, 31, 3, 8, 12, 17], target = 25",
      output: "-1",
      explanation: "25 isn't in the list.",
      args: [[22, 27, 31, 3, 8, 12, 17], 25],
      expected: -1,
    },
    {
      input: "nums = [9, 4], target = 4",
      output: "1",
      explanation: "A two-element list rotated by one.",
      args: [[9, 4], 4],
      expected: 1,
    },
  ],
  constraints: [
    "1 ≤ nums.length ≤ 5000",
    "-10⁴ ≤ nums[i], target ≤ 10⁴",
    "All values in nums are distinct",
    "nums is a sorted list rotated by some amount (possibly zero)",
  ],
  hints: [
    "The list isn't sorted overall, but if you split it anywhere, at least one of the two halves is still sorted.",
    "Compare `nums[low]` with `nums[mid]` to tell which half is sorted. For a sorted half, you can check directly whether `target` falls inside its range.",
    "If the left half `[low, mid]` is sorted and `nums[low] ≤ target < nums[mid]`, search left; otherwise search right. Mirror that logic when the right half is the sorted one.",
  ],
  keyIdea:
    "Any middle point splits a rotated list into one sorted half and one half that may contain the rotation point. The sorted half's first and last values tell you whether `target` could be inside it, so you can still discard half the range each step.",
  complexity: { time: "O(log n)", space: "O(1)" },
  tags: ["array", "rotated", "sorted"],
  externalRefs: [
    { label: "LeetCode 33", url: "https://leetcode.com/problems/search-in-rotated-sorted-array/" },
  ],
});
