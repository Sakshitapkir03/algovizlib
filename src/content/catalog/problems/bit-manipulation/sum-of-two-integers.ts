import { defineProblem } from "@/lib/catalog";

export const sumOfTwoIntegers = defineProblem({
  slug: "sum-of-two-integers",
  patternSlug: "bit-manipulation",
  title: "Sum of Two Integers",
  difficulty: "medium",
  order: 2,
  statement: `Given two integers \`a\` and \`b\`, return their sum without using the \`+\` or \`-\` operators (and without library helpers that add for you). Use bitwise operations instead.

Treat the numbers as 32-bit two's-complement integers; with the constraints below the result always fits.`,
  examples: [
    {
      input: "a = 9, b = 6",
      output: "15",
      explanation:
        "1001 ^ 0110 = 1111 and 1001 & 0110 = 0000, so there are no carries and the XOR is already the sum.",
      args: [9, 6],
      expected: 15,
    },
    {
      input: "a = -7, b = 3",
      output: "-4",
      explanation: "Two's complement makes negative numbers work with the same bit rules.",
      args: [-7, 3],
      expected: -4,
    },
    {
      input: "a = 0, b = -12",
      output: "-12",
      explanation: "Adding zero produces no carries at all.",
      args: [0, -12],
      expected: -12,
    },
  ],
  constraints: ["-1000 ≤ a, b ≤ 1000"],
  hints: [
    "Add two single bits by hand. Which bitwise operator gives the sum bit, and which gives the carry?",
    "For whole numbers, `a ^ b` adds every position while ignoring carries, and `(a & b) << 1` is exactly the carries, shifted into the position they add to.",
    "Loop while `b !== 0`: set `carry = (a & b) << 1`, `a = a ^ b`, `b = carry`. When no carries remain, `a` is the sum. In JavaScript, bitwise operators already work on 32-bit signed integers, so negatives are handled.",
  ],
  keyIdea:
    "Binary addition splits into two parts: the bits that add without carrying (`a ^ b`) and the carries (`(a & b) << 1`). Their sum is the answer, so repeat the split on those two numbers until the carry is zero. Each round pushes the carries at least one position left, so it ends within 32 rounds, and two's complement makes the same steps work for negative values.",
  complexity: { time: "O(1) (at most 32 iterations)", space: "O(1)" },
  tags: ["math", "xor", "carry"],
  externalRefs: [{ label: "LeetCode 371", url: "https://leetcode.com/problems/sum-of-two-integers/" }],
});
