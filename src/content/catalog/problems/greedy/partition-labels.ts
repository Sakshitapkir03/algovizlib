import { defineProblem } from "@/lib/catalog";

export const partitionLabels = defineProblem({
  slug: "partition-labels",
  patternSlug: "greedy",
  title: "Partition Labels",
  difficulty: "medium",
  order: 3,
  statement: `You are given a string \`s\` of lowercase letters. Cut it into as many consecutive pieces as possible so that every letter appears in at most one piece. Joining the pieces in order must give back \`s\`.

Return the lengths of the pieces, in order from left to right. There is always exactly one way to make the maximum number of cuts.`,
  examples: [
    {
      input: 's = "abacdcefge"',
      output: "[3, 3, 4]",
      explanation:
        'The pieces are "aba", "cdc", and "efge". Cutting "efge" further would split the two e\'s.',
      args: ["abacdcefge"],
      expected: [3, 3, 4],
    },
    {
      input: 's = "xyz"',
      output: "[1, 1, 1]",
      explanation: "No letter repeats, so every character is its own piece.",
      args: ["xyz"],
      expected: [1, 1, 1],
    },
    {
      input: 's = "mnnm"',
      output: "[4]",
      explanation: "The first and last characters are both m, so the whole string must stay together.",
      args: ["mnnm"],
      expected: [4],
    },
  ],
  constraints: ["1 ≤ s.length ≤ 500", "s contains only lowercase English letters"],
  hints: [
    "Once a piece contains some letter, it has to stretch at least to that letter's last occurrence.",
    "Precompute the last index of every letter. As you scan, how far must the current piece reach?",
    "Scan left to right keeping `end = max(end, last[s[i]])`. When `i == end`, nothing in the piece appears later, so close it there, record its length, and start the next piece at `i + 1`.",
  ],
  keyIdea:
    "Each letter's first and last occurrence form an interval that must stay inside one piece. Scan the string extending the current piece's end to the last occurrence of every letter you meet; the moment the scan index reaches that end, the piece is closed and cutting there is always safe, so cut as early as possible to maximize the number of pieces.",
  complexity: { time: "O(n)", space: "O(1) (26 letters)" },
  tags: ["string", "hash map", "intervals"],
  relatedPatterns: ["intervals"],
  externalRefs: [{ label: "LeetCode 763", url: "https://leetcode.com/problems/partition-labels/" }],
});
