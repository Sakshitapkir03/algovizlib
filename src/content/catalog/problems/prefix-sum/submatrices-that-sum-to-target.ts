import { defineProblem } from "@/lib/catalog";

export const submatricesThatSumToTarget = defineProblem({
  slug: "submatrices-that-sum-to-target",
  patternSlug: "prefix-sum",
  title: "Number of Submatrices That Sum to Target",
  difficulty: "hard",
  order: 4,
  statement: `You are given a 2D integer grid \`matrix\` (values may be negative) and an integer \`target\`. A submatrix is any non-empty rectangle of cells, chosen by a top row \`r1\`, bottom row \`r2\`, left column \`c1\`, and right column \`c2\` with \`r1 ≤ r2\` and \`c1 ≤ c2\`.

Return how many submatrices have cells that add up to exactly \`target\`. Two submatrices count separately when any of their four boundaries differ. Return \`0\` if none do.`,
  examples: [
    {
      input: "matrix = [[1, 2], [3, 4]], target = 3",
      output: "2",
      explanation: "The single cell 3, and the top row 1 + 2.",
      args: [
        [
          [1, 2],
          [3, 4],
        ],
        3,
      ],
      expected: 2,
    },
    {
      input: "matrix = [[1, -1], [-1, 1]], target = 0",
      output: "5",
      explanation: "Both rows, both columns, and the whole 2 × 2 grid each sum to 0.",
      args: [
        [
          [1, -1],
          [-1, 1],
        ],
        0,
      ],
      expected: 5,
    },
    {
      input: "matrix = [[2]], target = 3",
      output: "0",
      args: [[[2]], 3],
      expected: 0,
    },
  ],
  constraints: [
    "1 ≤ matrix.length ≤ 100",
    "1 ≤ matrix[0].length ≤ 100",
    "-1000 ≤ matrix[i][j] ≤ 1000",
    "-10⁸ ≤ target ≤ 10⁸",
  ],
  hints: [
    "Trying all four boundaries and summing each rectangle is far too slow. How would you count subarrays summing to `target` in a 1D array?",
    "Fix a top row and a bottom row. Collapse the rows between them into one array of column sums; every rectangle with those rows is now a subarray of that array.",
    "For each top row `r1`, keep a running column-sum array and extend the bottom row `r2` downward, adding row `r2` to it. For each `(r1, r2)`, count subarrays of the column sums equal to `target` with a prefix-sum hash map seeded with `{0: 1}`.",
  ],
  keyIdea:
    "Fixing the pair of rows reduces the 2D problem to 1D: the column sums between those rows form an array whose subarrays are exactly the rectangles with those rows. Counting subarrays that sum to `target` is the prefix-sum + hash-map trick, so the total is O(rows² · cols).",
  complexity: { time: "O(rows² · cols)", space: "O(cols)" },
  tags: ["matrix", "prefix sum", "hash map"],
  relatedPatterns: ["arrays-hashing"],
  externalRefs: [
    {
      label: "LeetCode 1074",
      url: "https://leetcode.com/problems/number-of-submatrices-that-sum-to-target/",
    },
  ],
});
