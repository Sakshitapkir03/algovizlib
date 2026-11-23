import { defineProblem } from "@/lib/catalog";

export const networkDelayTime = defineProblem({
  slug: "network-delay-time",
  patternSlug: "advanced-graphs",
  title: "Network Delay Time",
  difficulty: "medium",
  order: 2,
  statement: `A network has \`n\` servers labeled \`1\` to \`n\`. Each entry \`times[i] = [u, v, w]\` is a one-way link: a message sent from \`u\` arrives at \`v\` after \`w\` milliseconds.

Server \`k\` broadcasts a message at time \`0\`, and every server forwards it along all of its outgoing links as soon as it arrives. Return the time at which the last server receives the message. If some server can never receive it, return \`-1\`.`,
  examples: [
    {
      input: "times = [[1, 2, 4], [1, 3, 1], [3, 2, 2], [2, 4, 2], [4, 3, 1], [4, 5, 1]], n = 5, k = 1",
      output: "6",
      explanation:
        "Server 3 gets it at 1, server 2 at 3 (through 3, sooner than the direct 4), server 4 at 5, and server 5 at 6, the last arrival.",
      args: [
        [
          [1, 2, 4],
          [1, 3, 1],
          [3, 2, 2],
          [2, 4, 2],
          [4, 3, 1],
          [4, 5, 1],
        ],
        5,
        1,
      ],
      expected: 6,
    },
    {
      input: "times = [[1, 2, 4], [1, 3, 1], [3, 2, 2], [2, 4, 1]], n = 4, k = 1",
      output: "4",
      explanation:
        "Server 3 gets it at 1. Server 2 gets it at 3 via server 3 (faster than the direct 4). Server 4 gets it at 3 + 1 = 4, the latest arrival.",
      args: [
        [
          [1, 2, 4],
          [1, 3, 1],
          [3, 2, 2],
          [2, 4, 1],
        ],
        4,
        1,
      ],
      expected: 4,
    },
    {
      input: "times = [[1, 2, 5], [2, 3, 2]], n = 4, k = 1",
      output: "-1",
      explanation: "No link leads to server 4, so it never hears the message.",
      args: [
        [
          [1, 2, 5],
          [2, 3, 2],
        ],
        4,
        1,
      ],
      expected: -1,
    },
    {
      input: "times = [], n = 1, k = 1",
      output: "0",
      explanation: "The only server is the sender, which has the message at time 0.",
      args: [[], 1, 1],
      expected: 0,
    },
  ],
  constraints: [
    "1 ≤ k ≤ n ≤ 100",
    "0 ≤ times.length ≤ 6000",
    "1 ≤ u, v ≤ n, u ≠ v",
    "0 ≤ w ≤ 100",
    "No pair (u, v) appears twice",
  ],
  hints: [
    "Each server receives the message at the length of its shortest path from `k`. The answer is the largest of those.",
    "Links have different delays, so plain BFS (which counts hops) gives wrong times. Which server's arrival time can you be sure of first?",
    "Dijkstra: keep a min-heap of `(time, server)`. Pop the smallest; if the server is already settled, skip it, otherwise settle it and push each neighbor with `time + w`. Return the maximum settled time, or `-1` if fewer than `n` servers were settled.",
  ],
  keyIdea:
    "This is single-source shortest paths with non-negative weights. Dijkstra settles servers in order of arrival time: the unsettled server with the smallest tentative time can't be reached sooner by any other route, because every other route starts from a server that is already at least as late. The last server settled gives the answer.",
  complexity: { time: "O(E log E)", space: "O(n + E)" },
  tags: ["graph", "shortest path", "dijkstra", "heap"],
  relatedPatterns: ["heap"],
  externalRefs: [{ label: "LeetCode 743", url: "https://leetcode.com/problems/network-delay-time/" }],
});
