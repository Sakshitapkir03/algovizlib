import { defineProblem } from "@/lib/catalog";

export const validAnagram = defineProblem({
  slug: "valid-anagram",
  patternSlug: "arrays-hashing",
  title: "Valid Anagram",
  difficulty: "easy",
  order: 1,
  statement: `Two strings are anagrams when one can be rearranged into the other: they use exactly the same letters, each the same number of times.

Given lowercase strings \`s\` and \`t\`, return \`true\` if \`t\` is an anagram of \`s\`, and \`false\` otherwise.`,
  examples: [
    {
      input: 's = "listen", t = "silent"',
      output: "true",
      explanation: "Both use e, i, l, n, s, t once each.",
      args: ["listen", "silent"],
      expected: true,
    },
    {
      input: 's = "teeth", t = "theta"',
      output: "false",
      explanation: "Same length, but `s` has two e's and no a, while `t` has one e and an a.",
      args: ["teeth", "theta"],
      expected: false,
    },
    {
      input: 's = "abc", t = "abcc"',
      output: "false",
      explanation: "Different lengths can never be anagrams.",
      args: ["abc", "abcc"],
      expected: false,
    },
  ],
  constraints: ["1 ≤ s.length, t.length ≤ 5 × 10⁴", "s and t contain only lowercase English letters"],
  hints: [
    "If the lengths differ, the answer is immediate. Otherwise, what exactly has to match between the two strings?",
    "Sorting both strings and comparing works in O(n log n). Can you compare letter counts instead?",
    "Keep 26 counters. Add 1 for each letter of `s` and subtract 1 for each letter of `t`; the strings are anagrams exactly when every counter ends at 0.",
  ],
  keyIdea:
    "Anagrams have identical letter frequencies, and order is irrelevant. Count letters of `s` up and letters of `t` down in a 26-slot table; any non-zero slot means some letter is used a different number of times.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["string", "hash map", "counting"],
  externalRefs: [{ label: "LeetCode 242", url: "https://leetcode.com/problems/valid-anagram/" }],
});
