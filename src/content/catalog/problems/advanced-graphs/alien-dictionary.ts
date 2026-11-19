import { defineProblem } from "@/lib/catalog";

export const alienDictionary = defineProblem({
  slug: "alien-dictionary",
  patternSlug: "advanced-graphs",
  title: "Alien Dictionary",
  difficulty: "hard",
  order: 4,
  statement: `An alien language uses lowercase English letters, but in an unknown alphabetical order. You are given \`words\`, a list of words from its dictionary, claimed to be sorted by the alien order. Words are compared the usual way: at the first position where two words differ, the word with the earlier letter comes first, and if one word is a prefix of the other, the shorter word comes first.

Return a string containing every distinct letter that appears in \`words\`, each exactly once, in an order consistent with the list. Several orders may be consistent; to make the answer unique, build it one letter at a time and, whenever more than one letter could come next, take the one that is earliest in the ordinary English alphabet.

If no order can make the list sorted (the comparisons contradict each other, or a word appears before its own proper prefix), return \`""\`.`,
  examples: [
    {
      input: 'words = ["zx", "zb", "xa", "bc"]',
      output: '"aczxb"',
      explanation:
        'From "zx" < "zb" we learn x comes before b; from "zb" < "xa", z comes before x. Letters a and c have no constraints, so they go first, alphabetically. Then z, x, b.',
      args: [["zx", "zb", "xa", "bc"]],
      expected: "aczxb",
    },
    {
      input: 'words = ["ba", "ab", "bb"]',
      output: '""',
      explanation: "The first pair needs b before a; the second needs a before b. No order satisfies both.",
      args: [["ba", "ab", "bb"]],
      expected: "",
    },
    {
      input: 'words = ["cat", "ca"]',
      output: '""',
      explanation: '"ca" is a prefix of "cat", so it must come first in any order.',
      args: [["cat", "ca"]],
      expected: "",
    },
  ],
  constraints: [
    "1 ≤ words.length ≤ 100",
    "1 ≤ words[i].length ≤ 100",
    "words[i] contains only lowercase English letters",
  ],
  hints: [
    "Only adjacent words in the list tell you anything, and only at their first differing position.",
    "Turn each such difference into a directed edge `earlier → later` between letters. What does a valid alphabet look like in that graph? What makes one impossible?",
    'Run Kahn\'s algorithm over all letters that appear, but always take the alphabetically smallest letter with in-degree zero (a min-heap or a sorted set). Return `""` if a later word is a proper prefix of an earlier one, or if fewer letters come out than went in (a cycle).',
  ],
  keyIdea:
    "Comparing each pair of neighboring words yields at most one ordering fact: the first differing letters. Those facts form a directed graph over the letters, and a valid alphabet is a topological order of it. Kahn's algorithm finds one, and choosing the smallest available letter at each step makes the result unique. A cycle (letters left over) or a word followed by its own prefix means the list can't be sorted.",
  complexity: { time: "O(C + U log U), C = total characters, U = distinct letters", space: "O(U²)" },
  tags: ["graph", "topological sort", "string"],
  externalRefs: [
    { label: "LeetCode 269", url: "https://leetcode.com/problems/alien-dictionary/", premium: true },
  ],
});
