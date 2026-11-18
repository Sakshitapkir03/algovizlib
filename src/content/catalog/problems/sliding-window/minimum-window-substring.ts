import { defineProblem } from "@/lib/catalog";

export const minimumWindowSubstring = defineProblem({
  slug: "minimum-window-substring",
  patternSlug: "sliding-window",
  title: "Minimum Window Substring",
  difficulty: "hard",
  order: 3,
  statement: `You're given two strings, \`s\` and \`t\`. Find the shortest run of consecutive characters in \`s\` that contains every character of \`t\`, counting repeats: if \`t\` has a letter twice, the run must contain it at least twice. Matching is case-sensitive.

Return that run as a string. If no run of \`s\` covers \`t\`, return the empty string \`""\`. The shortest run is guaranteed to be unique when one exists.`,
  examples: [
    {
      input: 's = "XAYBZCAB", t = "ABC"',
      output: '"CAB"',
      explanation: '"AYBZC" and "BZCA" also cover A, B, and C, but "CAB" (indices 5 to 7) is the shortest.',
      args: ["XAYBZCAB", "ABC"],
      expected: "CAB",
    },
    {
      input: 's = "BXAYAZAB", t = "AAB"',
      output: '"AZAB"',
      explanation: 'The run needs two "A"s and a "B". "BXAYA" works with length 5, but "AZAB" does it in 4.',
      args: ["BXAYAZAB", "AAB"],
      expected: "AZAB",
    },
    {
      input: 's = "QRS", t = "QQ"',
      output: '""',
      explanation: 's has only one "Q", so nothing covers t.',
      args: ["QRS", "QQ"],
      expected: "",
    },
  ],
  constraints: ["1 ≤ s.length, t.length ≤ 10⁵", "s and t contain English letters only"],
  hints: [
    "Start by counting how many of each character t needs. How can you tell, cheaply, that a window has all of them?",
    "Expand the right edge until the window covers t. At that moment, the left edge may be able to move in without losing coverage.",
    "Keep a counter of how many required characters are still missing. Once it hits zero, shrink from the left while coverage holds, recording the shortest window, then resume expanding.",
  ],
  keyIdea:
    "Count what t needs and track how many of those characters the window is still missing. Move the right edge until nothing is missing, then move the left edge as far as possible while the window still covers t, recording each valid window's length. Both edges only move forward, so every character is added and removed at most once.",
  complexity: { time: "O(|s| + |t|)", space: "O(alphabet size)" },
  tags: ["string", "hash-map", "variable-window"],
  externalRefs: [{ label: "LeetCode 76", url: "https://leetcode.com/problems/minimum-window-substring/" }],
});
