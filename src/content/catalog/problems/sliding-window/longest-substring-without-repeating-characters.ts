import { defineProblem } from "@/lib/catalog";

export const longestSubstringWithoutRepeatingCharacters = defineProblem({
  slug: "longest-substring-without-repeating-characters",
  patternSlug: "sliding-window",
  title: "Longest Substring Without Repeating Characters",
  difficulty: "medium",
  order: 1,
  statement: `You're given a string \`s\`. Find the longest run of consecutive characters in \`s\` in which no character appears more than once, and return its length.

An empty string has no characters, so the answer for it is \`0\`.`,
  examples: [
    {
      input: 's = "pqrpsqt"',
      output: "5",
      explanation:
        '"rpsqt" (indices 2 to 6) has five distinct characters. Any longer run repeats a "p" or a "q".',
      args: ["pqrpsqt"],
      expected: 5,
    },
    {
      input: 's = "zzzz"',
      output: "1",
      explanation: 'Every run longer than one character repeats "z".',
      args: ["zzzz"],
      expected: 1,
    },
    {
      input: 's = ""',
      output: "0",
      args: [""],
      expected: 0,
    },
  ],
  constraints: ["0 ≤ s.length ≤ 5 × 10⁴", "s may contain letters, digits, symbols, and spaces"],
  hints: [
    "Checking every substring is O(n²) or worse. Can you extend one candidate run instead of restarting?",
    "Grow a window to the right. When the new character is already inside the window, the left edge has to move past its earlier copy.",
    "Remember the last index of each character. On a repeat inside the window, jump the left edge to one past that index, then update the best length.",
  ],
  keyIdea:
    "Keep a window with no duplicates and a map from each character to its most recent index. Extend the right edge one character at a time; if that character was last seen inside the window, move the left edge just past it. The window length after each step is a candidate answer.",
  complexity: { time: "O(n)", space: "O(min(n, alphabet size))" },
  tags: ["string", "hash-map", "variable-window"],
  relatedPatterns: ["arrays-hashing"],
  externalRefs: [
    {
      label: "LeetCode 3",
      url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
    },
  ],
});
