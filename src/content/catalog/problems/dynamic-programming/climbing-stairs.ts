import { defineProblem } from "@/lib/catalog";

export const climbingStairs = defineProblem({
  slug: "climbing-stairs",
  patternSlug: "dynamic-programming",
  title: "Climbing Stairs",
  difficulty: "easy",
  order: 0,
  statement: `You're at the bottom of a staircase with \`n\` steps. With each move you go up either 1 step or 2 steps.

Return the number of different sequences of moves that land you exactly on the top step. Two sequences are different if they differ in at least one move (so 1 then 2 is different from 2 then 1).`,
  examples: [
    {
      input: "n = 6",
      output: "13",
      explanation:
        "Group by how many 2-step moves you use: zero (1 way), one (5 ways), two (6 ways), three (1 way). 1 + 5 + 6 + 1 = 13.",
      args: [6],
      expected: 13,
    },
    {
      input: "n = 3",
      output: "3",
      explanation: "1+1+1, 1+2, and 2+1.",
      args: [3],
      expected: 3,
    },
    {
      input: "n = 1",
      output: "1",
      explanation: "A single 1-step move is the only option.",
      args: [1],
      expected: 1,
    },
  ],
  constraints: ["1 ≤ n ≤ 45"],
  hints: [
    "Think about the very last move you make to reach step `n`. What could it have been?",
    "Your last move was either 1 step (from step `n - 1`) or 2 steps (from step `n - 2`). How do the counts for those two steps combine?",
    "ways(n) = ways(n - 1) + ways(n - 2), with ways(0) = 1 and ways(1) = 1. Build upward from the bottom and keep only the last two counts.",
  ],
  keyIdea:
    "Every route to step `n` ends with either a 1-step move from `n - 1` or a 2-step move from `n - 2`, and those two groups never overlap. So the count for `n` is the sum of the counts for the two steps below it, which you can build bottom-up while remembering only the previous two values.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["dp", "counting", "fibonacci"],
  externalRefs: [{ label: "LeetCode 70", url: "https://leetcode.com/problems/climbing-stairs/" }],
});
