import { defineProblem } from "@/lib/catalog";

export const rangeSumQueries = defineProblem({
  slug: "range-sum-queries",
  patternSlug: "prefix-sum",
  title: "Range Sum Queries",
  difficulty: "easy",
  order: 1,
  statement: `You are given an integer array \`nums\` and a list of \`queries\`, where each query \`[l, r]\` asks for the sum \`nums[l] + nums[l + 1] + … + nums[r]\` (both ends included, \`0 ≤ l ≤ r < nums.length\`).

Return an array \`answers\` where \`answers[q]\` is the sum for \`queries[q]\`, in the same order as the queries. There can be many queries, so answering each one by adding up its range is too slow.`,
  examples: [
    {
      input: "nums = [4, -1, 3, 6, 2], queries = [[0, 2], [1, 3], [4, 4], [0, 4]]",
      output: "[6, 8, 2, 14]",
      explanation: "4 - 1 + 3 = 6, -1 + 3 + 6 = 8, the single element 2, and the whole array 14.",
      args: [
        [4, -1, 3, 6, 2],
        [
          [0, 2],
          [1, 3],
          [4, 4],
          [0, 4],
        ],
      ],
      expected: [6, 8, 2, 14],
    },
    {
      input: "nums = [5, 5, 5], queries = [[1, 2], [1, 2]]",
      output: "[10, 10]",
      explanation: "The same query can appear more than once; answer each one.",
      args: [
        [5, 5, 5],
        [
          [1, 2],
          [1, 2],
        ],
      ],
      expected: [10, 10],
    },
    {
      input: "nums = [7], queries = [[0, 0]]",
      output: "[7]",
      args: [[7], [[0, 0]]],
      expected: [7],
    },
  ],
  constraints: [
    "1 ≤ nums.length ≤ 10⁵",
    "-10⁴ ≤ nums[i] ≤ 10⁴",
    "1 ≤ queries.length ≤ 10⁵",
    "0 ≤ l ≤ r < nums.length",
  ],
  hints: [
    "Summing each range directly costs O(n) per query, O(n · q) overall. What could you compute once up front?",
    "If `prefix[i]` holds the sum of the first `i` elements, how do two of those values describe the range `[l, r]`?",
    "Build `prefix` of length `n + 1` with `prefix[0] = 0` and `prefix[i + 1] = prefix[i] + nums[i]`. Each query's answer is `prefix[r + 1] - prefix[l]`.",
  ],
  keyIdea:
    "A range sum is the difference of two running totals: everything up to `r` minus everything before `l`. Building the `n + 1` prefix totals takes one pass, after which every query is a single subtraction.",
  complexity: { time: "O(n + q)", space: "O(n)" },
  tags: ["array", "prefix sum"],
  externalRefs: [{ label: "LeetCode 303", url: "https://leetcode.com/problems/range-sum-query-immutable/" }],
});
