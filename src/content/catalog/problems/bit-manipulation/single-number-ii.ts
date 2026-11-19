import { defineProblem } from "@/lib/catalog";

export const singleNumberII = defineProblem({
  slug: "single-number-ii",
  patternSlug: "bit-manipulation",
  title: "Single Number II",
  difficulty: "medium",
  order: 3,
  statement: `You are given an array of integers \`nums\` in which every value appears exactly three times, except for one value that appears exactly once.

Return the value that appears once. Aim for linear time and constant extra space. Values can be negative; treat them as 32-bit two's-complement integers.`,
  examples: [
    {
      input: "nums = [5, 1, 5, 5]",
      output: "1",
      explanation: "5 appears three times; 1 appears once.",
      args: [[5, 1, 5, 5]],
      expected: 1,
    },
    {
      input: "nums = [-2, 8, -2, 8, 30, -2, 8]",
      output: "30",
      explanation: "-2 and 8 each appear three times, so their bits cancel out in every position.",
      args: [[-2, 8, -2, 8, 30, -2, 8]],
      expected: 30,
    },
    {
      input: "nums = [0, -9, 0, 0]",
      output: "-9",
      explanation: "The single value can be negative; its sign bit is set once, so it survives.",
      args: [[0, -9, 0, 0]],
      expected: -9,
    },
  ],
  constraints: [
    "1 ≤ nums.length ≤ 3 × 10⁴",
    "-2³¹ ≤ nums[i] ≤ 2³¹ - 1",
    "Exactly one value appears once; every other value appears exactly three times.",
  ],
  hints: [
    "XOR alone won't work: a value seen three times XORs back to itself. Look at a single bit position instead. How many of the numbers have that bit set?",
    "For each bit position, the count of numbers with that bit set is a multiple of 3, plus 1 if the single value has that bit. So `count % 3` is the single value's bit.",
    "Count bits per position for all 32 positions and rebuild the answer from `count % 3`. For O(1) per element, keep two masks: `ones = (ones ^ x) & ~twos` and `twos = (twos ^ x) & ~ones`; after the loop, `ones` is the answer.",
  ],
  keyIdea:
    "Each bit position is independent. Across the array, every tripled value contributes 0 or 3 to a position's count, so `count % 3` is exactly the single value's bit there. The two-mask version runs that mod-3 counter for all 32 positions at once: `ones` holds bits seen once (mod 3), `twos` bits seen twice, and a third sighting clears both.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "bit counting", "modular arithmetic"],
  externalRefs: [{ label: "LeetCode 137", url: "https://leetcode.com/problems/single-number-ii/" }],
});
