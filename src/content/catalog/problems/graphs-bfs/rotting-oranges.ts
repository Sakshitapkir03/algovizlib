import { defineProblem } from "@/lib/catalog";

export const rottingOranges = defineProblem({
  slug: "rotting-oranges",
  patternSlug: "graphs-bfs",
  title: "Rotting Oranges",
  difficulty: "medium",
  order: 2,
  statement: `A crate of oranges is a grid of numbers \`grid\`. Each cell is \`0\` (empty), \`1\` (a fresh orange), or \`2\` (a rotten orange).

Every minute, each fresh orange that sits directly above, below, left, or right of a rotten orange becomes rotten. All rotting in one minute happens at the same time.

Return the number of minutes until no fresh orange is left. If some fresh orange can never rot, return \`-1\`. If there are no fresh oranges to begin with, return \`0\`.`,
  examples: [
    {
      input: "grid = [[2, 1, 1], [1, 1, 0], [0, 1, 2]]",
      output: "2",
      explanation:
        "Two corners start rotten. After minute 1, the oranges at (0, 1), (1, 0), and (2, 1) are rotten. After minute 2, the last two at (0, 2) and (1, 1) are too.",
      args: [
        [
          [2, 1, 1],
          [1, 1, 0],
          [0, 1, 2],
        ],
      ],
      expected: 2,
    },
    {
      input: "grid = [[1, 0, 2]]",
      output: "-1",
      explanation: "The empty cell separates the fresh orange from the rotten one, so it never rots.",
      args: [[[1, 0, 2]]],
      expected: -1,
    },
    {
      input: "grid = [[0]]",
      output: "0",
      explanation: "There are no fresh oranges, so no time is needed.",
      args: [[[0]]],
      expected: 0,
    },
  ],
  constraints: ["1 ≤ rows, columns ≤ 10", "grid[r][c] is 0, 1, or 2"],
  hints: [
    "Simulating minute by minute works, but notice that the oranges rotting at minute k are exactly the fresh neighbors of those that rotted at minute k − 1.",
    "That's a breadth-first search, except it starts from every rotten orange at once instead of from one cell.",
    "Put all initially rotten oranges in the queue and count the fresh ones. Process the queue one level at a time, rotting fresh neighbors and decrementing the count; each finished level is one minute. At the end, return -1 if any fresh orange remains.",
  ],
  keyIdea:
    "Use a multi-source BFS: seed the queue with every rotten orange so they all spread in lockstep. Each BFS level is one minute, and a counter of remaining fresh oranges tells you at the end whether some were unreachable.",
  complexity: { time: "O(rows × columns)", space: "O(rows × columns)" },
  tags: ["grid", "bfs", "multi-source"],
  externalRefs: [{ label: "LeetCode 994", url: "https://leetcode.com/problems/rotting-oranges/" }],
});
