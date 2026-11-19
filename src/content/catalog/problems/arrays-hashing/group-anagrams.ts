import { defineProblem } from "@/lib/catalog";

export const groupAnagrams = defineProblem({
  slug: "group-anagrams",
  patternSlug: "arrays-hashing",
  title: "Group Anagrams",
  difficulty: "medium",
  order: 2,
  statement: `You are given an array of lowercase strings \`words\`. Two words belong together when they are anagrams of each other: rearranging the letters of one gives the other.

Split \`words\` into groups so that every word lands in exactly one group and each group holds all the words that are anagrams of one another. Duplicate words stay as separate entries in the same group. Return the list of groups; the groups, and the words inside each group, may be in any order.`,
  examples: [
    {
      input: 'words = ["stop", "pots", "rat", "tops", "art", "cat"]',
      output: '[["stop", "pots", "tops"], ["rat", "art"], ["cat"]]',
      explanation: '"cat" has no anagram partner, so it forms a group on its own.',
      args: [["stop", "pots", "rat", "tops", "art", "cat"]],
      expected: [["stop", "pots", "tops"], ["rat", "art"], ["cat"]],
    },
    {
      input: 'words = ["ab", "ba", "ab", "b"]',
      output: '[["ab", "ba", "ab"], ["b"]]',
      explanation: "The repeated word stays in the list twice.",
      args: [["ab", "ba", "ab", "b"]],
      expected: [["ab", "ba", "ab"], ["b"]],
    },
    {
      input: 'words = [""]',
      output: '[[""]]',
      explanation: "An empty string is a valid word and forms its own group.",
      args: [[""]],
      expected: [[""]],
    },
  ],
  judge: "unordered-nested",
  constraints: [
    "1 ≤ words.length ≤ 10⁴",
    "0 ≤ words[i].length ≤ 100",
    "words[i] contains only lowercase English letters",
  ],
  hints: [
    "Comparing every pair of words is slow. Could every word in a group be turned into the same label?",
    "Sorting a word's letters gives the same string for all of its anagrams. A count of each letter works too.",
    "Use a map from that label to a list. For each word, compute its label and append the word to that list; the map's values are the groups.",
  ],
  keyIdea:
    "Anagrams share a canonical form: their letters sorted, or their 26 letter counts. Use that form as a hash-map key and bucket each word under it in one pass. Every bucket is exactly one group.",
  complexity: {
    time: "O(n · k) with counts (O(n · k log k) with sorting), k = word length",
    space: "O(n · k)",
  },
  tags: ["string", "hash map", "sorting"],
  externalRefs: [{ label: "LeetCode 49", url: "https://leetcode.com/problems/group-anagrams/" }],
});
