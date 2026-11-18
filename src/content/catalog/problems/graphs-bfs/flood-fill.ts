import { defineProblem } from "@/lib/catalog";

export const floodFill = defineProblem({
  slug: "flood-fill",
  patternSlug: "graphs-bfs",
  title: "Flood Fill",
  difficulty: "easy",
  order: 0,
  statement: `A picture is stored as a grid of numbers \`image\`, where each number is a pixel's color. You click the paint bucket on pixel (\`sr\`, \`sc\`) with the new color \`color\`.

The bucket recolors the clicked pixel and every pixel connected to it through up, down, left, or right steps that has the same original color as the clicked pixel. Diagonal neighbors don't count as connected.

Return the grid after the fill. If the clicked pixel already has color \`color\`, the picture doesn't change.`,
  examples: [
    {
      input: "image = [[2, 2, 0], [2, 0, 0], [2, 2, 1]], sr = 0, sc = 0, color = 5",
      output: "[[5, 5, 0], [5, 0, 0], [5, 5, 1]]",
      explanation:
        "The five pixels of color 2 connected to the top-left corner become 5. The 0s and the 1 are untouched.",
      args: [
        [
          [2, 2, 0],
          [2, 0, 0],
          [2, 2, 1],
        ],
        0,
        0,
        5,
      ],
      expected: [
        [5, 5, 0],
        [5, 0, 0],
        [5, 5, 1],
      ],
    },
    {
      input: "image = [[1, 0, 1], [0, 1, 0]], sr = 1, sc = 1, color = 7",
      output: "[[1, 0, 1], [0, 7, 0]]",
      explanation: "The other 1s only touch the clicked pixel diagonally, so they keep their color.",
      args: [
        [
          [1, 0, 1],
          [0, 1, 0],
        ],
        1,
        1,
        7,
      ],
      expected: [
        [1, 0, 1],
        [0, 7, 0],
      ],
    },
    {
      input: "image = [[3, 3], [1, 3]], sr = 1, sc = 1, color = 3",
      output: "[[3, 3], [1, 3]]",
      explanation: "The clicked pixel is already color 3, so nothing changes.",
      args: [
        [
          [3, 3],
          [1, 3],
        ],
        1,
        1,
        3,
      ],
      expected: [
        [3, 3],
        [1, 3],
      ],
    },
  ],
  constraints: ["1 ≤ rows, columns ≤ 50", "0 ≤ image[r][c], color < 2¹⁶", "0 ≤ sr < rows, 0 ≤ sc < columns"],
  hints: [
    "Think of the pixels as a graph: each pixel links to its up, down, left, and right neighbors.",
    "Start from the clicked pixel and spread outward, only stepping onto pixels that still have the original color.",
    "Use a queue seeded with the clicked pixel. Recolor a pixel when you add it to the queue, so it can't be added twice. Skip everything if the new color equals the original.",
  ],
  keyIdea:
    "Remember the clicked pixel's original color, then breadth-first search from it, recoloring each matching neighbor as you enqueue it. Recoloring doubles as the visited mark, and the early exit when the colors already match prevents an endless loop.",
  complexity: { time: "O(rows × columns)", space: "O(rows × columns)" },
  tags: ["grid", "bfs", "matrix"],
  externalRefs: [{ label: "LeetCode 733", url: "https://leetcode.com/problems/flood-fill/" }],
});
