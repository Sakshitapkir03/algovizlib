import { defineProblem } from "@/lib/catalog";

export const countingBits = defineProblem({
  slug: "counting-bits",
  patternSlug: "bit-manipulation",
  title: "Counting Bits",
  difficulty: "easy",
  order: 1,
  statement: `Given a non-negative integer \`n\`, return an array \`bits\` of length \`n + 1\` where \`bits[i]\` is the number of \`1\` bits in the binary form of \`i\`, for every \`i\` from \`0\` to \`n\`.

Counting each number's bits separately is O(n log n). Try to fill the whole array in O(n) by reusing answers you have already computed.`,
  examples: [
    {
      input: "n = 6",
      output: "[0, 1, 1, 2, 1, 2, 2]",
      explanation: "In binary: 0, 1, 10, 11, 100, 101, 110.",
      args: [6],
      expected: [0, 1, 1, 2, 1, 2, 2],
    },
    {
      input: "n = 9",
      output: "[0, 1, 1, 2, 1, 2, 2, 3, 1, 2]",
      explanation: "7 is 111 (three ones), 8 is 1000 (one), 9 is 1001 (two).",
      args: [9],
      expected: [0, 1, 1, 2, 1, 2, 2, 3, 1, 2],
    },
    {
      input: "n = 0",
      output: "[0]",
      explanation: "Only the number 0, which has no set bits.",
      args: [0],
      expected: [0],
    },
  ],
  constraints: ["0 ≤ n ≤ 10⁵"],
  hints: [
    "Write out the binary forms of 0 to 15. How does the binary form of `i` relate to the binary form of `i >> 1`?",
    "Shifting right drops the last bit. So `i` has the same ones as `i >> 1`, plus one more if its last bit was set.",
    "Fill left to right with `bits[i] = bits[i >> 1] + (i & 1)`. Alternatively `bits[i] = bits[i & (i - 1)] + 1`, since `i & (i - 1)` clears the lowest set bit.",
  ],
  keyIdea:
    "Every number's bit count is one step away from a smaller number's: `i >> 1` has the same bits minus the last one, so `bits[i] = bits[i >> 1] + (i & 1)`. Filling the array in increasing order means the smaller answer is always ready, giving O(1) work per number.",
  complexity: { time: "O(n)", space: "O(1) extra (besides the output)" },
  tags: ["bit counting", "dynamic programming"],
  relatedPatterns: ["dynamic-programming"],
  externalRefs: [{ label: "LeetCode 338", url: "https://leetcode.com/problems/counting-bits/" }],
});
