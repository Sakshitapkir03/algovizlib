import { defineProblem } from "@/lib/catalog";

export const designAddAndSearchWords = defineProblem({
  slug: "design-add-and-search-words",
  patternSlug: "trie",
  title: "Design Add and Search Words Data Structure",
  difficulty: "medium",
  order: 2,
  statement: `Build a word dictionary whose search supports a wildcard. In a search pattern, the character \`.\` matches any single letter; every other character matches only itself.

Design a class \`WordDictionary\`:

- \`WordDictionary()\` creates an empty dictionary.
- \`addWord(word)\` stores the lowercase word \`word\`.
- \`search(pattern)\` returns \`true\` if some stored word has exactly the same length as \`pattern\` and matches it at every position, and \`false\` otherwise.`,
  examples: [
    {
      input:
        'WordDictionary, addWord("bat"), addWord("ball"), search("b..l"), search("ba"), search(".at"), search("c..")',
      output: "null, null, null, true, false, true, false",
      explanation:
        '"b..l" matches "ball". "ba" is only a prefix, so it fails. ".at" matches "bat". No stored word starts with c.',
      args: [
        ["WordDictionary", "addWord", "addWord", "search", "search", "search", "search"],
        [[], ["bat"], ["ball"], ["b..l"], ["ba"], [".at"], ["c.."]],
      ],
      expected: [null, null, null, true, false, true, false],
    },
    {
      input: 'WordDictionary, addWord("a"), search("."), search("..")',
      output: "null, null, true, false",
      explanation: "A single dot matches the one-letter word, but two dots need a two-letter word.",
      args: [
        ["WordDictionary", "addWord", "search", "search"],
        [[], ["a"], ["."], [".."]],
      ],
      expected: [null, null, true, false],
    },
  ],
  exampleFormat: "operations",
  constraints: [
    "1 ≤ word.length, pattern.length ≤ 25",
    "word contains lowercase English letters; pattern contains lowercase letters and '.'",
    "a pattern contains at most 2 dots",
    "at most 10⁴ calls in total",
  ],
  hints: [
    "Without dots this is a normal trie lookup. What changes when one character could be any letter?",
    "At a dot, you don't know which child to take, so try them all. Any one of them succeeding is enough.",
    "Store words in a trie. Search recursively with (node, position): a letter follows that one child; a dot tries every child at position + 1. At the end of the pattern, succeed only if the node marks a word end.",
  ],
  keyIdea:
    "A trie turns the wildcard into branching: a letter follows one edge, while a dot explores every child, backtracking when a branch dies. Letters keep the search narrow, so the cost is O(L) without dots and grows by at most a factor of 26 per dot.",
  complexity: { time: "O(L) per addWord; O(26ᵈ · L) per search with d dots", space: "O(total characters)" },
  tags: ["design", "trie", "depth-first search", "string"],
  relatedPatterns: ["design", "backtracking"],
  externalRefs: [
    {
      label: "LeetCode 211",
      url: "https://leetcode.com/problems/design-add-and-search-words-data-structure/",
    },
  ],
});
