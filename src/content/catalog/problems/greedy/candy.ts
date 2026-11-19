import { defineProblem } from "@/lib/catalog";

export const candy = defineProblem({
  slug: "candy",
  patternSlug: "greedy",
  title: "Candy",
  difficulty: "hard",
  order: 4,
  statement: `Children stand in a line, and \`ratings[i]\` is the score of child \`i\`. You hand out candy under two rules:

- every child gets at least one candy
- a child whose rating is strictly higher than an adjacent child's must get more candy than that neighbor

Children with equal ratings next to each other have no constraint between them. Return the smallest total number of candies that satisfies both rules.`,
  examples: [
    {
      input: "ratings = [1, 3, 2, 2, 1]",
      output: "7",
      explanation:
        "Give [1, 2, 1, 2, 1]. The two middle children rated 2 are equal, so only the second one needs more than the child rated 1 after it.",
      args: [[1, 3, 2, 2, 1]],
      expected: 7,
    },
    {
      input: "ratings = [1, 2, 3, 3, 2]",
      output: "9",
      explanation: "Give [1, 2, 3, 2, 1].",
      args: [[1, 2, 3, 3, 2]],
      expected: 9,
    },
    {
      input: "ratings = [4]",
      output: "1",
      explanation: "A single child just needs the minimum of one candy.",
      args: [[4]],
      expected: 1,
    },
  ],
  constraints: ["1 ≤ ratings.length ≤ 2 · 10⁴", "0 ≤ ratings[i] ≤ 2 · 10⁴"],
  hints: [
    "The rule involves both neighbors. Try satisfying only the left neighbor first.",
    "One left-to-right pass can give each child `left[i]`: 1, or one more than the child on the left if rated higher. A right-to-left pass can do the same for the right neighbor.",
    "Each child needs at least `max(left[i], right[i])`, and giving exactly that satisfies both rules. Sum those values.",
  ],
  keyIdea:
    "Split the two-sided rule into two one-sided ones. A left-to-right pass computes the minimum each child needs to beat a lower-rated left neighbor (1 plus the left count on an increase, otherwise 1); a right-to-left pass does the same for the right neighbor. Taking the larger of the two per child satisfies both constraints, and neither value can be lowered, so the sum is minimal.",
  complexity: { time: "O(n)", space: "O(n)" },
  tags: ["array", "two passes"],
  externalRefs: [{ label: "LeetCode 135", url: "https://leetcode.com/problems/candy/" }],
});
