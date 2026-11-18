import { defineProblem } from "@/lib/catalog";

export const houseRobber = defineProblem({
  slug: "house-robber",
  patternSlug: "dynamic-programming",
  title: "House Robber",
  difficulty: "medium",
  order: 1,
  statement: `A burglar is working a single street of houses. \`money[i]\` is the cash stashed in house \`i\`. Neighboring houses share an alarm system: if two houses next to each other are both broken into on the same night, the alarm goes off.

Return the largest total amount the burglar can take in one night without ever breaking into two adjacent houses.`,
  examples: [
    {
      input: "money = [3, 10, 4, 2, 9]",
      output: "19",
      explanation: "Take houses 1 and 4: 10 + 9 = 19. Taking houses 0, 2 and 4 only gives 3 + 4 + 9 = 16.",
      args: [[3, 10, 4, 2, 9]],
      expected: 19,
    },
    {
      input: "money = [6, 1, 1, 7]",
      output: "13",
      explanation: "Take the first and last houses: 6 + 7 = 13. Skipping two houses in a row is allowed.",
      args: [[6, 1, 1, 7]],
      expected: 13,
    },
    {
      input: "money = [5]",
      output: "5",
      explanation: "With only one house, take it.",
      args: [[5]],
      expected: 5,
    },
  ],
  constraints: ["1 ≤ money.length ≤ 100", "0 ≤ money[i] ≤ 400"],
  hints: [
    "Greedily taking every other house fails. Think about one house at a time: what are your two options at house `i`?",
    "At house `i` you either skip it (keep the best total up to `i - 1`) or rob it (its cash plus the best total up to `i - 2`).",
    "best(i) = max(best(i - 1), best(i - 2) + money[i]). Walk the street once, carrying only the last two best totals.",
  ],
  keyIdea:
    "Let best(i) be the most you can take from the first `i + 1` houses. At each house you either skip it and keep best(i - 1), or rob it and add its cash to best(i - 2), since its neighbor must be skipped. Taking the larger option at each house and keeping just two running totals gives the answer in one pass.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["dp", "array"],
  externalRefs: [{ label: "LeetCode 198", url: "https://leetcode.com/problems/house-robber/" }],
});
