import { defineProblem } from "@/lib/catalog";

export const searchInsertPosition = defineProblem({
  slug: "search-insert-position",
  patternSlug: "binary-search",
  title: "Search Insert Position",
  difficulty: "easy",
  order: 1,
  statement: `You're given a list of distinct numbers \`nums\` sorted from smallest to largest, and a number \`target\`.

If \`target\` is in the list, return its position (0-based). Otherwise, return the position where it would have to be inserted to keep the list sorted. That position can be \`nums.length\` when \`target\` is larger than every element. Aim for O(log n) time.`,
  examples: [
    {
      input: "nums = [2, 5, 9, 14, 20], target = 14",
      output: "3",
      explanation: "14 is already at position 3.",
      args: [[2, 5, 9, 14, 20], 14],
      expected: 3,
    },
    {
      input: "nums = [2, 5, 9, 14, 20], target = 7",
      output: "2",
      explanation: "7 belongs between 5 and 9, so it would go at position 2.",
      args: [[2, 5, 9, 14, 20], 7],
      expected: 2,
    },
    {
      input: "nums = [3, 8, 12], target = 15",
      output: "3",
      explanation: "15 is bigger than everything, so it goes at the end.",
      args: [[3, 8, 12], 15],
      expected: 3,
    },
  ],
  constraints: [
    "1 ≤ nums.length ≤ 10⁴",
    "-10⁴ ≤ nums[i], target ≤ 10⁴",
    "nums is sorted in strictly increasing order",
  ],
  hints: [
    'The answer is the first position whose value is at least `target`. How would you find a "first position where something becomes true"?',
    "Run a binary search, but when it fails, think about where `low` ends up relative to `target`.",
    "Use `low = 0`, `high = nums.length`. While `low < high`: if `nums[mid] < target` set `low = mid + 1`, else `high = mid`. Return `low`.",
  ],
  keyIdea:
    'The insert position is the first index whose value is at least `target`, and "value ≥ target" is false then true along a sorted list. Binary search for that boundary: when the middle is too small, the boundary is to its right; otherwise it\'s at the middle or to its left.',
  complexity: { time: "O(log n)", space: "O(1)" },
  tags: ["array", "sorted", "lower-bound"],
  externalRefs: [{ label: "LeetCode 35", url: "https://leetcode.com/problems/search-insert-position/" }],
});
