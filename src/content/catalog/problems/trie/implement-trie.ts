import { defineProblem } from "@/lib/catalog";

export const implementTrie = defineProblem({
  slug: "implement-trie",
  patternSlug: "trie",
  title: "Implement Trie (Prefix Tree)",
  difficulty: "medium",
  order: 1,
  statement: `Build a prefix tree that stores lowercase words and answers exact-word and prefix questions.

Design a class \`Trie\`:

- \`Trie()\` creates an empty trie.
- \`insert(word)\` stores \`word\`. Inserting a word twice has no extra effect.
- \`search(word)\` returns \`true\` if \`word\` was inserted before, and \`false\` otherwise. A word that is only a prefix of a stored word does not count.
- \`startsWith(prefix)\` returns \`true\` if at least one stored word begins with \`prefix\` (a stored word counts as a prefix of itself), and \`false\` otherwise.`,
  examples: [
    {
      input: 'Trie, insert("cart"), insert("cab"), search("car"), search("cab"), startsWith("cap")',
      output: "null, null, null, false, true, false",
      explanation:
        '"car" is a prefix of "cart" but was never inserted. "cab" was. No word continues "ca" with p.',
      args: [
        ["Trie", "insert", "insert", "search", "search", "startsWith"],
        [[], ["cart"], ["cab"], ["car"], ["cab"], ["cap"]],
      ],
      expected: [null, null, null, false, true, false],
    },
    {
      input:
        'Trie, insert("cart"), search("car"), search("cart"), startsWith("car"), insert("car"), search("car")',
      output: "null, null, false, true, true, null, true",
      explanation:
        '"car" is only a prefix of "cart" until it is inserted itself; after that, search("car") is true.',
      args: [
        ["Trie", "insert", "search", "search", "startsWith", "insert", "search"],
        [[], ["cart"], ["car"], ["cart"], ["car"], ["car"], ["car"]],
      ],
      expected: [null, null, false, true, true, null, true],
    },
    {
      input: 'Trie, insert("dog"), startsWith("dog"), startsWith("dogs"), search("do")',
      output: "null, null, true, false, false",
      explanation: 'A word is a prefix of itself, but "dogs" goes past the end of every stored word.',
      args: [
        ["Trie", "insert", "startsWith", "startsWith", "search"],
        [[], ["dog"], ["dog"], ["dogs"], ["do"]],
      ],
      expected: [null, null, true, false, false],
    },
    {
      input: 'Trie, search("a"), startsWith("a")',
      output: "null, false, false",
      explanation: "An empty trie contains nothing.",
      args: [
        ["Trie", "search", "startsWith"],
        [[], ["a"], ["a"]],
      ],
      expected: [null, false, false],
    },
  ],
  exampleFormat: "operations",
  constraints: [
    "1 ≤ word.length, prefix.length ≤ 2000",
    "word and prefix contain only lowercase English letters",
    "at most 3 × 10⁴ calls in total",
  ],
  hints: [
    "Storing words in a set handles search, but startsWith would have to check every word. Words sharing a beginning should share storage.",
    "Make each node a map from a character to a child node. Walking the characters of a string from the root either reaches a node or falls off.",
    "insert creates missing children along the path and marks the last node as a word end. search walks the path and checks that mark; startsWith only checks that the walk didn't fall off.",
  ],
  keyIdea:
    "Each trie node has up to 26 children and an end-of-word flag. All three operations walk one node per character, so they take O(L) time for a string of length L, independent of how many words are stored. search and startsWith differ only in whether the final node must be flagged.",
  complexity: { time: "O(L) per operation", space: "O(total characters inserted)" },
  tags: ["design", "trie", "string"],
  relatedPatterns: ["design"],
  externalRefs: [{ label: "LeetCode 208", url: "https://leetcode.com/problems/implement-trie-prefix-tree/" }],
});
