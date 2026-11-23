import { defineProblem } from "@/lib/catalog";

export const wordSearchII = defineProblem({
  slug: "word-search-ii",
  patternSlug: "trie",
  title: "Word Search II",
  difficulty: "hard",
  order: 4,
  statement: `You are given a grid of lowercase letters, \`board\`, and a list of distinct words, \`words\`. A word can be traced on the board by starting at any cell and moving step by step to a horizontally or vertically adjacent cell, reading one letter per cell. A single cell may not be used twice within the same word.

Return every word from \`words\` that can be traced on the board, in any order. Return an empty array if none can.`,
  examples: [
    {
      input: 'board = [["c","a","t"],["o","r","e"]], words = ["cat", "car", "care", "cot"]',
      output: '["car", "care", "cat"]',
      explanation:
        '"car" and "care" go c → a → r (→ e); "cat" goes c → a → t. "cot" reaches o, but no t touches it. The order is the order the search finds them.',
      args: [
        [
          ["c", "a", "t"],
          ["o", "r", "e"],
        ],
        ["cat", "car", "care", "cot"],
      ],
      expected: ["car", "care", "cat"],
    },
    {
      input:
        'board = [["c","a","t","s"],["o","r","e","a"],["d","e","n","p"]], words = ["cat", "care", "code", "rent", "sap", "dog"]',
      output: '["cat", "care", "code", "sap"]',
      explanation:
        '"care" goes c → a → r → e (right, down, right). "rent" reaches n, but no t touches it. There is no g anywhere, so "dog" fails.',
      args: [
        [
          ["c", "a", "t", "s"],
          ["o", "r", "e", "a"],
          ["d", "e", "n", "p"],
        ],
        ["cat", "care", "code", "rent", "sap", "dog"],
      ],
      expected: ["cat", "care", "code", "sap"],
    },
    {
      input: 'board = [["a","b"],["c","d"]], words = ["abdc", "abcd", "acdb"]',
      output: '["abdc", "acdb"]',
      explanation: '"abcd" needs to step from b to c, but those cells are diagonal, not adjacent.',
      args: [
        [
          ["a", "b"],
          ["c", "d"],
        ],
        ["abdc", "abcd", "acdb"],
      ],
      expected: ["abdc", "acdb"],
    },
    {
      input: 'board = [["a"]], words = ["a", "aa"]',
      output: '["a"]',
      explanation: '"aa" would need to use the only cell twice.',
      args: [[["a"]], ["a", "aa"]],
      expected: ["a"],
    },
  ],
  judge: "unordered",
  constraints: [
    "1 ≤ board.length, board[i].length ≤ 12",
    "1 ≤ words.length ≤ 3 × 10⁴",
    "1 ≤ words[i].length ≤ 10",
    "board and words contain only lowercase English letters; all words are distinct",
  ],
  hints: [
    "Searching the board separately for each word repeats the same exploration many times when words share beginnings.",
    "Put all the words in a trie. Then one depth-first search from each cell can follow the board and the trie together.",
    "From each cell, DFS while the trie has a child for the current letter, marking cells as in use and unmarking on the way back. When you reach a word-end node, record the word and clear its mark so it isn't reported twice. Pruning trie nodes that run out of words speeds it up further.",
  ],
  keyIdea:
    "A trie of the words lets one backtracking search explore all of them at once: each DFS step moves to a neighboring cell and to the matching trie child, and it stops the moment no word continues with that letter. Shared prefixes are explored once instead of once per word.",
  complexity: { time: "O(m · n · 4 · 3^(L−1)) for max word length L", space: "O(total characters in words)" },
  tags: ["matrix", "trie", "backtracking", "depth-first search"],
  relatedPatterns: ["backtracking"],
  externalRefs: [{ label: "LeetCode 212", url: "https://leetcode.com/problems/word-search-ii/" }],
});
