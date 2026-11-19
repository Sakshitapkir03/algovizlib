import { defineProblem } from "@/lib/catalog";

export const minimumIntervalToIncludeEachQuery = defineProblem({
  slug: "minimum-interval-to-include-each-query",
  patternSlug: "intervals",
  title: "Minimum Interval to Include Each Query",
  difficulty: "hard",
  order: 4,
  statement: `You're given a list of closed ranges, \`intervals\`, where \`intervals[i] = [left, right]\` covers every integer from \`left\` to \`right\` inclusive. The size of a range is the number of integers it covers: \`right - left + 1\`.

You're also given a list of integers, \`queries\`. For each query \`q\`, find the smallest size among the ranges that contain \`q\` (that is, \`left ≤ q ≤ right\`).

Return an array \`answer\` where \`answer[j]\` is that smallest size for \`queries[j]\`, or \`-1\` if no range contains \`queries[j]\`. The answers stay in the same order as the queries, and repeated queries get repeated answers.`,
  examples: [
    {
      input: "intervals = [[2, 5], [3, 4], [1, 8], [6, 6]], queries = [3, 6, 9, 1]",
      output: "[2, 1, -1, 8]",
      explanation:
        "3 is in [2, 5] (size 4), [3, 4] (size 2), and [1, 8] (size 8), so 2. 6 is in [1, 8] and [6, 6], so 1. Nothing contains 9. Only [1, 8] contains 1.",
      args: [
        [
          [2, 5],
          [3, 4],
          [1, 8],
          [6, 6],
        ],
        [3, 6, 9, 1],
      ],
      expected: [2, 1, -1, 8],
    },
    {
      input: "intervals = [[1, 3], [2, 6]], queries = [2, 2, 5]",
      output: "[3, 3, 5]",
      explanation: "Both ranges contain 2; [1, 3] is smaller. Only [2, 6] contains 5.",
      args: [
        [
          [1, 3],
          [2, 6],
        ],
        [2, 2, 5],
      ],
      expected: [3, 3, 5],
    },
    {
      input: "intervals = [[4, 4]], queries = [3]",
      output: "[-1]",
      explanation: "The only range covers just 4.",
      args: [[[4, 4]], [3]],
      expected: [-1],
    },
  ],
  constraints: [
    "1 ≤ intervals.length ≤ 10⁵",
    "1 ≤ queries.length ≤ 10⁵",
    "1 ≤ left ≤ right ≤ 10⁷",
    "1 ≤ queries[j] ≤ 10⁷",
  ],
  hints: [
    "Checking every range for every query is O(n·q). What if you answered the queries from smallest to largest instead of in the given order?",
    "Sort ranges by `left` and queries by value. As the query grows, which ranges become eligible, and which stop being useful for good?",
    "Sweep the sorted queries. Push every range with `left ≤ q` onto a min-heap keyed by size (remembering its `right`). Pop from the top while its `right < q`. The top's size is the answer, or `-1` if the heap is empty. Write answers back by original index.",
  ],
  keyIdea:
    "Answer queries offline in increasing order. Ranges are added to a min-heap by size once their `left` is at most the query, and a range whose `right` falls below the current query can never help a larger query, so it's discarded when it reaches the top. The top of the heap is then the smallest range containing the query.",
  complexity: { time: "O((n + q) log n + q log q)", space: "O(n + q)" },
  tags: ["array", "sorting", "heap", "line sweep"],
  relatedPatterns: ["heap"],
  externalRefs: [
    {
      label: "LeetCode 1851",
      url: "https://leetcode.com/problems/minimum-interval-to-include-each-query/",
    },
  ],
});
