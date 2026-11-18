import { defineProblem } from "@/lib/catalog";

export const longestCommonSubsequence = defineProblem({
  slug: "longest-common-subsequence",
  patternSlug: "dynamic-programming",
  title: "Longest Common Subsequence",
  difficulty: "medium",
  order: 3,
  statement: `A subsequence of a string is what remains after deleting zero or more characters without reordering the rest. For example, \`"bor"\` is a subsequence of \`"harbor"\`, but \`"rob"\` is not.

Given two strings \`a\` and \`b\`, return the length of the longest string that is a subsequence of both. If they share no characters, return \`0\`.`,
  examples: [
    {
      input: 'a = "harbor", b = "board"',
      output: "3",
      explanation: '"bor" appears in order in both strings, and no common subsequence of length 4 exists.',
      args: ["harbor", "board"],
      expected: 3,
    },
    {
      input: 'a = "stone", b = "notes"',
      output: "2",
      explanation:
        'Both strings contain the same letters, but the orders clash. The best you can do is a pair such as "ne" or "te".',
      args: ["stone", "notes"],
      expected: 2,
    },
    {
      input: 'a = "abc", b = "xyz"',
      output: "0",
      explanation: "No character appears in both strings.",
      args: ["abc", "xyz"],
      expected: 0,
    },
  ],
  constraints: ["1 ≤ a.length, b.length ≤ 1000", "a and b contain only lowercase English letters"],
  hints: [
    "Compare the strings from the front, one prefix of each at a time. What smaller question does the pair of prefixes reduce to?",
    "Look at the last character of each prefix. If they match, that character can end the common subsequence. If they don't, one of the two characters must be dropped.",
    "Let L[i][j] be the answer for the first `i` characters of `a` and the first `j` of `b`. On a match L[i][j] = L[i-1][j-1] + 1; otherwise L[i][j] = max(L[i-1][j], L[i][j-1]). Row 0 and column 0 are 0.",
  ],
  keyIdea:
    "Fill a grid where cell (i, j) holds the answer for the first `i` characters of `a` and the first `j` of `b`. Matching last characters extend the diagonal answer by one; otherwise drop a character from one side and take the better result. Each row only needs the row above it, so memory can shrink to one row.",
  complexity: { time: "O(m × n)", space: "O(min(m, n))" },
  tags: ["dp", "string", "2d-dp"],
  externalRefs: [
    { label: "LeetCode 1143", url: "https://leetcode.com/problems/longest-common-subsequence/" },
  ],
});
