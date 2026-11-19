import { defineProblem } from "@/lib/catalog";

export const replaceWords = defineProblem({
  slug: "replace-words",
  patternSlug: "trie",
  title: "Replace Words",
  difficulty: "medium",
  order: 3,
  statement: `You are given a list of word roots, \`roots\`, and a \`sentence\` of lowercase words separated by single spaces. Shorten the sentence: replace every word that starts with at least one root by the shortest root it starts with. Words that start with no root stay unchanged.

Return the resulting sentence, with words still separated by single spaces.`,
  examples: [
    {
      input: 'roots = ["re", "for", "form", "un"], sentence = "they reran the format unchanged"',
      output: '"they re the for un"',
      explanation:
        '"format" starts with both "for" and "form"; the shorter one wins. "they" and "the" match no root.',
      args: [["re", "for", "form", "un"], "they reran the format unchanged"],
      expected: "they re the for un",
    },
    {
      input: 'roots = ["a", "aa"], sentence = "aaa ab b"',
      output: '"a a b"',
      explanation: 'A root can be the whole word or a single letter; "b" matches nothing.',
      args: [["a", "aa"], "aaa ab b"],
      expected: "a a b",
    },
    {
      input: 'roots = ["xyz"], sentence = "hello world"',
      output: '"hello world"',
      explanation: "No word starts with a root, so the sentence is unchanged.",
      args: [["xyz"], "hello world"],
      expected: "hello world",
    },
  ],
  constraints: [
    "1 ≤ roots.length ≤ 1000",
    "1 ≤ roots[i].length ≤ 100",
    "1 ≤ sentence.length ≤ 10⁶",
    "roots[i] and the words of sentence contain only lowercase English letters",
  ],
  hints: [
    "Checking every root against every word is slow when both lists are long. You want, for each word, its shortest prefix that is a root.",
    "If all the roots live in a trie, walking a word's characters from the root visits every prefix of that word in order of length.",
    "Insert the roots into a trie. For each word, walk its characters; the first node you reach that marks a root end gives the replacement. If you fall off the trie or run out of characters first, keep the word.",
  ],
  keyIdea:
    "With the roots in a trie, walking a word letter by letter checks its prefixes from shortest to longest, so the first word-end node reached is the shortest matching root. Each word costs at most its own length, and the walk stops early as soon as the trie has no matching child.",
  complexity: { time: "O(total root characters + sentence length)", space: "O(total root characters)" },
  tags: ["string", "trie", "hash set"],
  externalRefs: [{ label: "LeetCode 648", url: "https://leetcode.com/problems/replace-words/" }],
});
