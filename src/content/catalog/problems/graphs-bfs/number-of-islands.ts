import { defineProblem } from "@/lib/catalog";

export const numberOfIslands = defineProblem({
  slug: "number-of-islands",
  patternSlug: "graphs-bfs",
  title: "Number of Islands",
  difficulty: "medium",
  order: 1,
  statement: `A map is given as a list of strings \`grid\`, one string per row. Each character is \`'1'\` for land or \`'0'\` for water.

An island is a group of land cells joined by up, down, left, or right steps. Cells that only touch diagonally belong to different islands. Everything outside the grid is water.

Return the number of islands.`,
  examples: [
    {
      input: 'grid = ["11000", "10011", "00010", "01001"]',
      output: "4",
      explanation:
        "One island in the top-left corner (3 cells), one on the right (3 cells), and two single cells in the bottom row.",
      args: [["11000", "10011", "00010", "01001"]],
      expected: 4,
    },
    {
      input: 'grid = ["101", "010", "101"]',
      output: "5",
      explanation: "The land cells only touch diagonally, so each one is its own island.",
      args: [["101", "010", "101"]],
      expected: 5,
    },
    {
      input: 'grid = ["000", "000"]',
      output: "0",
      explanation: "There's no land at all.",
      args: [["000", "000"]],
      expected: 0,
    },
  ],
  constraints: [
    "1 ≤ grid.length ≤ 300",
    "1 ≤ grid[r].length ≤ 300, and every row has the same length",
    "Each character is '0' or '1'",
  ],
  hints: [
    "Scan the grid. When you hit a land cell you haven't seen before, you've found a new island.",
    "Once you find a new island, you need to make sure none of its other cells get counted again.",
    "On each unseen land cell, add 1 to the count and run a BFS from it, marking every connected land cell as visited.",
  ],
  keyIdea:
    "Walk every cell. Each unvisited land cell starts a new island: count it, then breadth-first search outward to mark the whole island visited. Every cell is enqueued at most once, so the total work is linear in the grid size.",
  complexity: { time: "O(rows × columns)", space: "O(rows × columns)" },
  tags: ["grid", "bfs", "connected-components"],
  externalRefs: [{ label: "LeetCode 200", url: "https://leetcode.com/problems/number-of-islands/" }],
});
