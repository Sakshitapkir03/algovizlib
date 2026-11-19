import { defineProblem } from "@/lib/catalog";

export const nQueens = defineProblem({
  slug: "n-queens",
  patternSlug: "backtracking",
  title: "N-Queens",
  difficulty: "hard",
  order: 4,
  statement: `Place \`n\` chess queens on an \`n × n\` board so that no two attack each other: no two share a row, a column, or a diagonal.

Return every valid arrangement. Write each board as a list of \`n\` strings, one per row from top to bottom, where \`"Q"\` marks a queen and \`"."\` an empty square. Return the boards in any order (the rows inside a board stay top to bottom). If there is no valid arrangement, return an empty list \`[]\`.`,
  examples: [
    {
      input: "n = 4",
      output: '[[".Q..", "...Q", "Q...", "..Q."], ["..Q.", "Q...", "...Q", ".Q.."]]',
      explanation: "A 4 × 4 board has exactly two arrangements, mirror images of each other.",
      args: [4],
      expected: [
        [".Q..", "...Q", "Q...", "..Q."],
        ["..Q.", "Q...", "...Q", ".Q.."],
      ],
    },
    {
      input: "n = 3",
      output: "[]",
      explanation:
        "Wherever the first-row queen goes, the second and third rows can't both be filled safely.",
      args: [3],
      expected: [],
    },
    {
      input: "n = 1",
      output: '[["Q"]]',
      args: [1],
      expected: [["Q"]],
    },
  ],
  judge: "unordered",
  constraints: ["1 ≤ n ≤ 9"],
  hints: [
    "Every row holds exactly one queen, so decide one row at a time: which column gets this row's queen?",
    "A square is safe if its column and both of its diagonals are free. Squares on the same `↘` diagonal share `row - col`; squares on the same `↙` diagonal share `row + col`.",
    "Keep three sets (columns, `row - col`, `row + col`). In `place(row)`, try every column whose three keys are free: add them, recurse to `row + 1`, then remove them. When `row == n`, turn the column choices into strings and save the board.",
  ],
  keyIdea:
    "Place one queen per row, top to bottom. For the current row, try each column whose column and two diagonals are unclaimed, recording them in sets keyed by `col`, `row - col`, and `row + col` so each safety check is O(1). Recurse to the next row and release the three keys on return. Any row with no safe column ends that branch immediately, which prunes most of the n^n possible placements.",
  complexity: { time: "O(n!)", space: "O(n) besides the output" },
  tags: ["matrix", "constraint search", "pruning"],
  externalRefs: [{ label: "LeetCode 51", url: "https://leetcode.com/problems/n-queens/" }],
});
