import { defineProblem } from "@/lib/catalog";

export const slidingWindowMaximum = defineProblem({
  slug: "sliding-window-maximum",
  patternSlug: "sliding-window",
  title: "Sliding Window Maximum",
  difficulty: "hard",
  order: 4,
  statement: `You're given a list of integers \`nums\` and a window size \`k\`. Place a window over the first \`k\` elements, then slide it right one position at a time until it covers the last \`k\` elements.

Return a list with the largest value in each window position, from left to right. The result has \`nums.length - k + 1\` entries.`,
  examples: [
    {
      input: "nums = [2, 7, 3, 1, 5, 4, 6], k = 3",
      output: "[7, 7, 5, 5, 6]",
      explanation: "The windows are [2, 7, 3], [7, 3, 1], [3, 1, 5], [1, 5, 4], and [5, 4, 6].",
      args: [[2, 7, 3, 1, 5, 4, 6], 3],
      expected: [7, 7, 5, 5, 6],
    },
    {
      input: "nums = [9, 8, 7, 6], k = 2",
      output: "[9, 8, 7]",
      explanation: "In a decreasing list, each window's maximum is its first element.",
      args: [[9, 8, 7, 6], 2],
      expected: [9, 8, 7],
    },
    {
      input: "nums = [4, -1], k = 1",
      output: "[4, -1]",
      explanation: "With k = 1, every element is its own window.",
      args: [[4, -1], 1],
      expected: [4, -1],
    },
  ],
  constraints: ["1 ≤ k ≤ nums.length ≤ 10⁵", "-10⁴ ≤ nums[i] ≤ 10⁴"],
  hints: [
    "Scanning each window for its maximum is O(n·k). Which elements can never be a future maximum?",
    "If a newer element is at least as large as an older one, the older one leaves the window first and is always beaten, so it can be forgotten.",
    "Keep a deque of indices whose values are decreasing. Pop smaller values from the back before pushing, drop the front once it falls out of the window, and read the maximum from the front.",
  ],
  keyIdea:
    "Maintain a deque of indices whose values strictly decrease from front to back. Each new element evicts smaller values from the back, the front is removed once it slides out of the window, and the front is always the current maximum. Every index is pushed and popped at most once.",
  complexity: { time: "O(n)", space: "O(k)" },
  tags: ["array", "deque", "monotonic-queue"],
  relatedPatterns: ["heap"],
  externalRefs: [{ label: "LeetCode 239", url: "https://leetcode.com/problems/sliding-window-maximum/" }],
});
