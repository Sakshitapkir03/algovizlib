import { defineProblem } from "@/lib/catalog";

export const longestRepeatingCharacterReplacement = defineProblem({
  slug: "longest-repeating-character-replacement",
  patternSlug: "sliding-window",
  title: "Longest Repeating Character Replacement",
  difficulty: "medium",
  order: 2,
  statement: `You're given a string \`s\` of uppercase English letters and a non-negative integer \`k\`. You may change at most \`k\` characters of \`s\`, each into any uppercase letter.

Return the length of the longest run of identical consecutive letters you can produce.`,
  examples: [
    {
      input: 's = "BAABCBB", k = 1',
      output: "4",
      explanation:
        'Change the "C" in "BCBB" to get "BBBB". No block of five letters has four that already match.',
      args: ["BAABCBB", 1],
      expected: 4,
    },
    {
      input: 's = "ABBCBA", k = 2',
      output: "5",
      explanation: 'In "ABBCB", change the "A" and the "C" to "B" to get five "B"s in a row.',
      args: ["ABBCBA", 2],
      expected: 5,
    },
    {
      input: 's = "XYZ", k = 0',
      output: "1",
      explanation: "With no changes allowed, every letter is its own run.",
      args: ["XYZ", 0],
      expected: 1,
    },
  ],
  constraints: ["1 ≤ s.length ≤ 10⁵", "s contains only uppercase English letters", "0 ≤ k ≤ s.length"],
  hints: [
    "For a fixed block of letters, how many changes does it take to make them all the same?",
    "A block needs (its length − the count of its most frequent letter) changes. It works if that number is at most k.",
    "Grow a window to the right while tracking letter counts and the highest count seen. When length − highest count exceeds k, slide the left edge forward by one.",
  ],
  keyIdea:
    "A window is fixable when its length minus the count of its most common letter is at most k. Expand the right edge, update counts, and whenever the window becomes unfixable, move the left edge one step. The window never shrinks, so its final size is the longest valid length.",
  complexity: { time: "O(n)", space: "O(1) (26 counters)" },
  tags: ["string", "variable-window", "counting"],
  externalRefs: [
    {
      label: "LeetCode 424",
      url: "https://leetcode.com/problems/longest-repeating-character-replacement/",
    },
  ],
});
