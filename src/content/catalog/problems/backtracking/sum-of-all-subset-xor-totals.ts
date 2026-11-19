import { defineProblem } from "@/lib/catalog";

export const sumOfAllSubsetXorTotals = defineProblem({
  slug: "sum-of-all-subset-xor-totals",
  patternSlug: "backtracking",
  title: "Sum of All Subset XOR Totals",
  difficulty: "easy",
  order: 0,
  statement: `The XOR total of a list of numbers is the bitwise XOR of all of them (\`^\` in most languages); the XOR total of an empty list is \`0\`.

Given an array \`nums\`, consider every subset you can form by picking some of its positions (including none and all of them). Subsets that happen to contain equal values still count separately when they use different positions. Return the sum of the XOR totals of all \`2ⁿ\` subsets.`,
  examples: [
    {
      input: "nums = [2, 5]",
      output: "14",
      explanation: "The subsets are [], [2], [5], [2, 5] with XOR totals 0, 2, 5, 7. Their sum is 14.",
      args: [[2, 5]],
      expected: 14,
    },
    {
      input: "nums = [1, 4, 6]",
      output: "28",
      explanation:
        "XOR totals: [] 0, [1] 1, [4] 4, [6] 6, [1, 4] 5, [1, 6] 7, [4, 6] 2, [1, 4, 6] 3. The sum is 28.",
      args: [[1, 4, 6]],
      expected: 28,
    },
    {
      input: "nums = [3]",
      output: "3",
      explanation: "Only [] (0) and [3] (3).",
      args: [[3]],
      expected: 3,
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 12", "1 ≤ nums[i] ≤ 20"],
  hints: [
    "With at most 12 numbers there are at most 4,096 subsets, so visiting every one is fine.",
    "Each number is either in the subset or not. Write a recursive function that decides for index `i` and carries the XOR so far.",
    "`dfs(i, xor)`: if `i == n`, return `xor`; otherwise return `dfs(i + 1, xor ^ nums[i]) + dfs(i + 1, xor)`. Call `dfs(0, 0)`.",
  ],
  keyIdea:
    "Every subset is a path of include/skip decisions, one per index. Recurse through the indices carrying the running XOR; at the end of a path the running value is that subset's total, so summing what the leaves return adds up all 2ⁿ totals. (A bit trick gives O(n): every bit that appears in any number is set in exactly half the subsets, so the answer is the OR of all numbers times 2ⁿ⁻¹.)",
  complexity: { time: "O(2ⁿ)", space: "O(n) recursion depth" },
  tags: ["array", "subsets", "xor"],
  relatedPatterns: ["bit-manipulation"],
  externalRefs: [
    { label: "LeetCode 1863", url: "https://leetcode.com/problems/sum-of-all-subset-xor-totals/" },
  ],
});
