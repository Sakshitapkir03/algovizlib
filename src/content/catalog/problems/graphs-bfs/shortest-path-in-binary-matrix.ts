import { defineProblem } from "@/lib/catalog";

export const shortestPathInBinaryMatrix = defineProblem({
  slug: "shortest-path-in-binary-matrix",
  patternSlug: "graphs-bfs",
  title: "Shortest Path in a Binary Matrix",
  difficulty: "medium",
  order: 3,
  statement: `You're given an \`n × n\` grid of numbers \`grid\`, where \`0\` is an open cell and \`1\` is a wall. You start in the top-left cell and want to reach the bottom-right cell.

From any open cell you may step to any of its 8 neighbors (including diagonals), as long as that neighbor is open and inside the grid.

Return the length of the shortest route, counted as the number of cells visited including the start and the end. If the start or end is a wall, or no route exists, return \`-1\`.`,
  examples: [
    {
      input: "grid = [[0, 0, 0, 1], [1, 1, 0, 1], [1, 1, 1, 0], [1, 1, 1, 0]]",
      output: "5",
      explanation:
        "One shortest route is (0, 0) → (0, 1) → (1, 2) → (2, 3) → (3, 3). The straight diagonal is blocked, so 4 cells isn't possible.",
      args: [
        [
          [0, 0, 0, 1],
          [1, 1, 0, 1],
          [1, 1, 1, 0],
          [1, 1, 1, 0],
        ],
      ],
      expected: 5,
    },
    {
      input: "grid = [[1, 0], [0, 0]]",
      output: "-1",
      explanation: "The starting cell is a wall.",
      args: [
        [
          [1, 0],
          [0, 0],
        ],
      ],
      expected: -1,
    },
    {
      input: "grid = [[0]]",
      output: "1",
      explanation: "The start is also the end, so the route is a single cell.",
      args: [[[0]]],
      expected: 1,
    },
  ],
  constraints: ["1 ≤ n ≤ 100", "grid[r][c] is 0 or 1"],
  hints: [
    "Every step costs the same, whichever of the 8 directions you take. Which search finds the fewest steps in that case?",
    "Breadth-first search from the top-left cell reaches cells in order of their distance, so the first time you reach the corner is the answer.",
    "Check that both corners are open, enqueue the start with distance 1, and for each cell try all 8 neighbors, marking them visited as you enqueue them with distance + 1. Return the distance when you dequeue the bottom-right cell, or -1 if the queue empties.",
  ],
  keyIdea:
    "Treat each open cell as a node linked to its open 8-directional neighbors. Because all moves cost one, BFS from the start visits cells in nondecreasing distance, so the distance recorded when the bottom-right cell is reached is the shortest route length.",
  complexity: { time: "O(n²)", space: "O(n²)" },
  tags: ["grid", "bfs", "shortest-path"],
  externalRefs: [
    { label: "LeetCode 1091", url: "https://leetcode.com/problems/shortest-path-in-binary-matrix/" },
  ],
});
