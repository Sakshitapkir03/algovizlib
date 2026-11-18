import { defineProblem } from "@/lib/catalog";

export const wordLadder = defineProblem({
  slug: "word-ladder",
  patternSlug: "graphs-bfs",
  title: "Word Ladder",
  difficulty: "hard",
  order: 4,
  statement: `You're given a starting word \`beginWord\`, a goal word \`endWord\`, and a dictionary \`wordList\`. All words have the same length and use lowercase letters.

A ladder turns \`beginWord\` into \`endWord\` by changing exactly one letter at a time. Every word after \`beginWord\` (including \`endWord\`) must appear in \`wordList\`. \`beginWord\` itself doesn't need to be in the list.

Return the number of words in the shortest ladder, counting both \`beginWord\` and \`endWord\`. If no ladder exists, return \`0\`.`,
  examples: [
    {
      input:
        'beginWord = "cold", endWord = "warm", wordList = ["cord", "card", "ward", "warm", "worm", "word"]',
      output: "5",
      explanation:
        'One shortest ladder is "cold" → "cord" → "card" → "ward" → "warm". All four letters differ, so no ladder can be shorter than 5 words.',
      args: ["cold", "warm", ["cord", "card", "ward", "warm", "worm", "word"]],
      expected: 5,
    },
    {
      input: 'beginWord = "lamp", endWord = "fire", wordList = ["lame", "fame", "fare"]',
      output: "0",
      explanation: '"fire" isn\'t in the dictionary, so no ladder can end there.',
      args: ["lamp", "fire", ["lame", "fame", "fare"]],
      expected: 0,
    },
    {
      input: 'beginWord = "cat", endWord = "cot", wordList = ["cot"]',
      output: "2",
      explanation: "A single letter change reaches the goal, so the ladder has two words.",
      args: ["cat", "cot", ["cot"]],
      expected: 2,
    },
  ],
  constraints: [
    "1 ≤ beginWord.length ≤ 10",
    "endWord.length and every wordList[i].length equal beginWord.length",
    "1 ≤ wordList.length ≤ 5000, and its words are distinct",
    "beginWord ≠ endWord",
  ],
  hints: [
    "Picture each word as a node, with an edge between two words that differ in exactly one letter. What are you looking for in that graph?",
    "You want the fewest edges from beginWord to endWord, and all edges cost the same, so breadth-first search fits. Comparing every pair of words is slow, though.",
    "To find a word's neighbors, try replacing each position with each of the 26 letters and check a set of unused dictionary words. Remove a word from the set when you enqueue it, and track the ladder length per BFS level.",
  ],
  keyIdea:
    "Model words as nodes joined when they differ by one letter, and run BFS from beginWord. Generate neighbors by swapping each letter for every alternative and looking them up in a set, removing words as they're enqueued so each is visited once. The BFS level at which endWord appears is the ladder length.",
  complexity: { time: "O(N × L × 26)", space: "O(N × L)" },
  tags: ["string", "bfs", "shortest-path"],
  externalRefs: [{ label: "LeetCode 127", url: "https://leetcode.com/problems/word-ladder/" }],
});
