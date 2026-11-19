import { defineProblem } from "@/lib/catalog";

export const longestCommonPrefix = defineProblem({
  slug: "longest-common-prefix",
  patternSlug: "trie",
  title: "Longest Common Prefix",
  difficulty: "easy",
  order: 0,
  statement: `Given an array of strings \`words\`, return the longest string that is a prefix of every word in the array.

If the words share no common starting characters, return the empty string \`""\`.`,
  examples: [
    {
      input: 'words = ["interview", "internal", "interval"]',
      output: '"inter"',
      explanation: 'All three start with "inter"; the next letters (v, n, v) disagree.',
      args: [["interview", "internal", "interval"]],
      expected: "inter",
    },
    {
      input: 'words = ["map", "apple"]',
      output: '""',
      explanation: "The first letters already differ, so nothing is shared.",
      args: [["map", "apple"]],
      expected: "",
    },
    {
      input: 'words = ["go", "gopher", "goal"]',
      output: '"go"',
      explanation: "A whole word can be the common prefix.",
      args: [["go", "gopher", "goal"]],
      expected: "go",
    },
  ],
  constraints: [
    "1 ≤ words.length ≤ 200",
    "0 ≤ words[i].length ≤ 200",
    "words[i] contains only lowercase English letters",
  ],
  hints: [
    "The common prefix can never be longer than the shortest word.",
    "Compare the words one column at a time: does every word have the same character at position i?",
    "Equivalently, insert every word into a trie and walk down from the root while the current node has exactly one child and isn't the end of a word. The path you walked is the answer.",
  ],
  keyIdea:
    "In a trie of all the words, the common prefix is the single unbranching path from the root: stop as soon as a node has two children or marks the end of a word. A column-by-column scan gives the same answer with O(1) extra space; both touch each character at most once.",
  complexity: { time: "O(total characters)", space: "O(total characters) with a trie, O(1) with a scan" },
  tags: ["string", "trie"],
  externalRefs: [{ label: "LeetCode 14", url: "https://leetcode.com/problems/longest-common-prefix/" }],
});
