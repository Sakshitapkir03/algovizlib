import { defineProblem } from "@/lib/catalog";

export const productOfArrayExceptSelf = defineProblem({
  slug: "product-of-array-except-self",
  patternSlug: "prefix-sum",
  title: "Product of Array Except Self",
  difficulty: "medium",
  order: 3,
  statement: `Given an integer array \`nums\`, return an array \`out\` of the same length where \`out[i]\` is the product of every element of \`nums\` except \`nums[i]\`.

Don't use division (it fails as soon as \`nums\` contains a zero), and aim for O(n) time. Every product fits in a 32-bit signed integer. Apart from the output array, try to use only O(1) extra memory.`,
  examples: [
    {
      input: "nums = [2, 3, 4, 5]",
      output: "[60, 40, 30, 24]",
      explanation: "out[0] = 3 · 4 · 5 = 60, out[1] = 2 · 4 · 5 = 40, and so on.",
      args: [[2, 3, 4, 5]],
      expected: [60, 40, 30, 24],
    },
    {
      input: "nums = [3, 0, 2, 4]",
      output: "[0, 24, 0, 0]",
      explanation: "Only the position holding the zero gets a non-zero product: 3 · 2 · 4 = 24.",
      args: [[3, 0, 2, 4]],
      expected: [0, 24, 0, 0],
    },
    {
      input: "nums = [-1, 6]",
      output: "[6, -1]",
      args: [[-1, 6]],
      expected: [6, -1],
    },
  ],
  constraints: [
    "2 ≤ nums.length ≤ 10⁵",
    "-30 ≤ nums[i] ≤ 30",
    "Every product of a subset of nums fits in a 32-bit signed integer",
  ],
  hints: [
    'Recomputing the product for each index is O(n²). Split "everything except `i`" into two parts you could precompute.',
    "`out[i]` = (product of everything left of `i`) × (product of everything right of `i`). Both are running products, like prefix sums with multiplication.",
    "Fill `out` left to right with the running product of earlier elements (starting at 1). Then sweep right to left with a second running product of later elements, multiplying it into `out[i]`.",
  ],
  keyIdea:
    "The product of all elements except `nums[i]` is a prefix product times a suffix product. A forward pass stores prefix products in the output, and a backward pass multiplies in suffix products with one variable, so no division and no extra arrays are needed.",
  complexity: { time: "O(n)", space: "O(1) extra (besides the output)" },
  tags: ["array", "prefix product"],
  externalRefs: [
    { label: "LeetCode 238", url: "https://leetcode.com/problems/product-of-array-except-self/" },
  ],
});
