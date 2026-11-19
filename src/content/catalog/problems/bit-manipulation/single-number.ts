import { defineProblem } from "@/lib/catalog";

export const singleNumber = defineProblem({
  slug: "single-number",
  patternSlug: "bit-manipulation",
  title: "Single Number",
  difficulty: "easy",
  order: 0,
  statement: `You are given a non-empty array of integers \`nums\` in which every value appears exactly twice, except for one value that appears exactly once.

Return the value that appears once. Aim for linear time and constant extra space, so no hash set or sorting.`,
  examples: [
    {
      input: "nums = [6, 3, 6, 9, 3]",
      output: "9",
      explanation: "6 and 3 each appear twice; 9 appears once.",
      args: [[6, 3, 6, 9, 3]],
      expected: 9,
    },
    {
      input: "nums = [0, 1, 0]",
      output: "1",
      args: [[0, 1, 0]],
      expected: 1,
    },
    {
      input: "nums = [-4]",
      output: "-4",
      explanation: "With a single element, it is the answer.",
      args: [[-4]],
      expected: -4,
    },
  ],
  constraints: [
    "1 ≤ nums.length ≤ 3 × 10⁴ (always odd)",
    "-3 × 10⁴ ≤ nums[i] ≤ 3 × 10⁴",
    "Exactly one value appears once; every other value appears exactly twice.",
  ],
  hints: [
    "Is there an operation that combines a value with itself and gives back nothing, no matter what the value is?",
    "XOR has `x ^ x = 0` and `x ^ 0 = x`, and it doesn't care about order. What happens if you XOR every element together?",
    "Start with `acc = 0` and XOR in every element. Each pair cancels to 0, so `acc` ends as the unpaired value.",
  ],
  keyIdea:
    "XOR is commutative and associative, and `x ^ x = 0`. XOR-ing the whole array is the same as grouping each pair together, and every pair cancels, leaving only the value that appears once. One pass, one variable.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "xor"],
  externalRefs: [{ label: "LeetCode 136", url: "https://leetcode.com/problems/single-number/" }],
});
