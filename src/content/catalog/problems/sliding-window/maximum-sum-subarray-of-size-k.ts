import { defineProblem } from "@/lib/catalog";

export const maximumSumSubarrayOfSizeK = defineProblem({
  slug: "maximum-sum-subarray-of-size-k",
  patternSlug: "sliding-window",
  title: "Maximum Sum Subarray of Size K",
  difficulty: "easy",
  order: 0,
  statement: `You're given a list of integers \`nums\` and a positive integer \`k\`. Look at every block of exactly \`k\` consecutive elements and return the largest sum any such block has.

The values can be negative, so the answer can be negative too.`,
  examples: [
    {
      input: "nums = [3, 1, 6, 2, 5, 4, 1], k = 3",
      output: "13",
      explanation: "The blocks sum to 10, 9, 13, 11, and 10. The best is 6 + 2 + 5 = 13.",
      args: [[3, 1, 6, 2, 5, 4, 1], 3],
      expected: 13,
    },
    {
      input: "nums = [-4, -2, -7, -1], k = 2",
      output: "-6",
      explanation: "The blocks sum to -6, -9, and -8, so the largest is -6.",
      args: [[-4, -2, -7, -1], 2],
      expected: -6,
    },
    {
      input: "nums = [8], k = 1",
      output: "8",
      explanation: "There is only one block.",
      args: [[8], 1],
      expected: 8,
    },
  ],
  constraints: ["1 ≤ k ≤ nums.length ≤ 10⁵", "-10⁴ ≤ nums[i] ≤ 10⁴"],
  hints: [
    "Adding up each block from scratch costs O(k) per block. How much do two neighbouring blocks have in common?",
    "When the block moves one step right, exactly one value joins and one value leaves.",
    "Sum the first k values, then for each next index add the new value, subtract the one k positions back, and track the maximum.",
  ],
  keyIdea:
    "Compute the sum of the first k elements once. Slide the window one step at a time by adding the entering element and subtracting the leaving one, so each new sum costs O(1). Keep the largest sum seen.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "fixed-window", "prefix-sum"],
});
