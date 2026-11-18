import { defineProblem } from "@/lib/catalog";

export const coinChange = defineProblem({
  slug: "coin-change",
  patternSlug: "dynamic-programming",
  title: "Coin Change",
  difficulty: "medium",
  order: 2,
  statement: `A cashier has an unlimited supply of coins in each denomination listed in \`coins\` and needs to hand out exactly \`amount\` in change.

Return the fewest coins that add up to exactly \`amount\`. If no combination of coins makes \`amount\`, return \`-1\`. An \`amount\` of 0 needs 0 coins.`,
  examples: [
    {
      input: "coins = [1, 4, 5], amount = 8",
      output: "2",
      explanation:
        "4 + 4 uses 2 coins. Grabbing the biggest coin first (5 + 1 + 1 + 1) uses 4, so greedy doesn't work here.",
      args: [[1, 4, 5], 8],
      expected: 2,
    },
    {
      input: "coins = [2, 5, 10], amount = 27",
      output: "4",
      explanation: "10 + 10 + 5 + 2 = 27. No three of these coins add up to 27.",
      args: [[2, 5, 10], 27],
      expected: 4,
    },
    {
      input: "coins = [4, 6], amount = 7",
      output: "-1",
      explanation: "Every coin is even, so no combination can reach an odd amount.",
      args: [[4, 6], 7],
      expected: -1,
    },
    {
      input: "coins = [3], amount = 0",
      output: "0",
      explanation: "Nothing to pay, so no coins are needed.",
      args: [[3], 0],
      expected: 0,
    },
  ],
  constraints: ["1 ≤ coins.length ≤ 12", "1 ≤ coins[i] ≤ 2³¹ - 1", "0 ≤ amount ≤ 10⁴"],
  hints: [
    "Always taking the largest coin that fits can give the wrong answer. Can you answer the question for every smaller amount first?",
    "If you knew the fewest coins for every amount below `a`, the last coin you hand out for `a` is one of the denominations. What's left after it?",
    "fewest(a) = 1 + min over coins c ≤ a of fewest(a - c), with fewest(0) = 0 and unreachable amounts marked as infinity. Fill amounts 1 through `amount` in order.",
  ],
  keyIdea:
    "Build a table where entry `a` is the fewest coins that make amount `a`. For each amount, try every coin as the last one handed out and take the best of 1 + fewest(a - coin). Amounts that no coin can reach stay at infinity, which becomes `-1` at the end.",
  complexity: { time: "O(amount × coins.length)", space: "O(amount)" },
  tags: ["dp", "array", "unbounded-knapsack"],
  externalRefs: [{ label: "LeetCode 322", url: "https://leetcode.com/problems/coin-change/" }],
});
