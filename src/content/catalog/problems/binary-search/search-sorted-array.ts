import { defineProblem } from "@/lib/catalog";

export const searchSortedArray = defineProblem({
  slug: "search-sorted-array",
  patternSlug: "binary-search",
  title: "Search a Sorted Array",
  difficulty: "easy",
  order: 0,
  statement: `You're given a list of distinct numbers \`nums\` sorted from smallest to largest, and a number \`target\`. Return the position (0-based) where \`target\` appears in \`nums\`.

If \`target\` isn't in the list, return \`-1\`. Aim for a solution faster than scanning every element.`,
  examples: [
    {
      input: "nums = [-7, -2, 3, 8, 15, 21, 30], target = 15",
      output: "4",
      explanation: "nums[4] = 15.",
      args: [[-7, -2, 3, 8, 15, 21, 30], 15],
      expected: 4,
    },
    {
      input: "nums = [4, 11, 19, 26], target = 12",
      output: "-1",
      explanation: "12 would sit between 11 and 19, but it isn't in the list.",
      args: [[4, 11, 19, 26], 12],
      expected: -1,
    },
    {
      input: "nums = [6], target = 6",
      output: "0",
      explanation: "A single-element list that matches.",
      args: [[6], 6],
      expected: 0,
    },
  ],
  constraints: [
    "1 ≤ nums.length ≤ 10⁵",
    "-10⁹ ≤ nums[i], target ≤ 10⁹",
    "nums is sorted in strictly increasing order",
  ],
  hints: [
    "Look at the middle element first. What does comparing it with `target` tell you about the rest of the list?",
    "If the middle value is smaller than `target`, the answer can't be at or before the middle. Keep a `low` and `high` boundary and shrink it.",
    "Loop while `low ≤ high`: compute `mid`, return it on a match, otherwise set `low = mid + 1` or `high = mid - 1`. If the range empties, return -1.",
  ],
  keyIdea:
    "Keep a range `[low, high]` that must contain `target` if it exists. Compare the middle value with `target` and discard the half that can't hold it. The range halves every step, so it either finds the value or becomes empty after about log₂(n) checks.",
  complexity: { time: "O(log n)", space: "O(1)" },
  tags: ["array", "sorted"],
  externalRefs: [{ label: "LeetCode 704", url: "https://leetcode.com/problems/binary-search/" }],
});
