import { defineProblem } from "@/lib/catalog";

export const editDistance = defineProblem({
  slug: "edit-distance",
  patternSlug: "dynamic-programming",
  title: "Edit Distance",
  difficulty: "hard",
  order: 4,
  statement: `You want to turn string \`source\` into string \`target\`. One edit is any of:

- insert a single character anywhere,
- delete a single character, or
- replace a single character with a different one.

Return the minimum number of edits needed. If the strings are already equal, return \`0\`.`,
  examples: [
    {
      input: 'source = "dinner", target = "winter"',
      output: "2",
      explanation: 'Replace "d" with "w" and the second "n" with "t".',
      args: ["dinner", "winter"],
      expected: 2,
    },
    {
      input: 'source = "cart", target = "act"',
      output: "2",
      explanation:
        'Delete "c" to get "art", then replace "r" with "c" to get "act". Deleting any single character from "cart" never gives "act", so 1 edit isn\'t enough.',
      args: ["cart", "act"],
      expected: 2,
    },
    {
      input: 'source = "", target = "sun"',
      output: "3",
      explanation: "Insert all three characters.",
      args: ["", "sun"],
      expected: 3,
    },
  ],
  constraints: [
    "0 ≤ source.length, target.length ≤ 500",
    "Both strings contain only lowercase English letters",
  ],
  hints: [
    "Work from the ends of both strings. Focus on the last character of each: what happens if they already match?",
    "If the last characters differ, the final edit was an insert, a delete, or a replace. Each one leaves a smaller pair of prefixes to fix.",
    "Let D[i][j] be the cost to turn the first `i` characters of `source` into the first `j` of `target`. D[i][0] = i and D[0][j] = j. On a match D[i][j] = D[i-1][j-1]; otherwise 1 + min(D[i-1][j], D[i][j-1], D[i-1][j-1]).",
  ],
  keyIdea:
    "Fill a grid over prefixes of both strings. A matching pair of last characters costs nothing, so copy the diagonal cell. Otherwise pay one edit and take the cheapest of delete (cell above), insert (cell to the left), or replace (diagonal). The bottom-right cell is the answer, and only two rows need to live in memory at once.",
  complexity: { time: "O(m × n)", space: "O(min(m, n))" },
  tags: ["dp", "string", "2d-dp"],
  externalRefs: [{ label: "LeetCode 72", url: "https://leetcode.com/problems/edit-distance/" }],
});
