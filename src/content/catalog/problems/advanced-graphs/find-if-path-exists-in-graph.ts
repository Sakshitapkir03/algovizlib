import { defineProblem } from "@/lib/catalog";

export const findIfPathExistsInGraph = defineProblem({
  slug: "find-if-path-exists-in-graph",
  patternSlug: "advanced-graphs",
  title: "Find if Path Exists in Graph",
  difficulty: "easy",
  order: 0,
  statement: `An undirected graph has \`n\` nodes labeled \`0\` to \`n - 1\`. The list \`edges\` holds its edges, where \`edges[i] = [u, v]\` connects nodes \`u\` and \`v\` in both directions. No edge repeats and no edge connects a node to itself.

Given two nodes \`source\` and \`destination\`, return \`true\` if you can walk from \`source\` to \`destination\` along the edges, and \`false\` otherwise. A node can always reach itself.`,
  examples: [
    {
      input: "n = 6, edges = [[0, 1], [1, 2], [3, 4], [4, 2]], source = 4, destination = 0",
      output: "true",
      explanation:
        "Edge 4-2 joins the group {3, 4} to the group {0, 1, 2}, so 4 reaches 0 (for example 4 → 2 → 1 → 0). Node 5 has no edges and stays alone.",
      args: [
        6,
        [
          [0, 1],
          [1, 2],
          [3, 4],
          [4, 2],
        ],
        4,
        0,
      ],
      expected: true,
    },
    {
      input: "n = 6, edges = [[0, 1], [1, 2], [3, 4], [4, 5]], source = 0, destination = 2",
      output: "true",
      explanation: "Walk 0 → 1 → 2.",
      args: [
        6,
        [
          [0, 1],
          [1, 2],
          [3, 4],
          [4, 5],
        ],
        0,
        2,
      ],
      expected: true,
    },
    {
      input: "n = 6, edges = [[0, 1], [1, 2], [3, 4], [4, 5]], source = 2, destination = 5",
      output: "false",
      explanation: "Nodes 0, 1, 2 form one group and 3, 4, 5 another; no edge joins them.",
      args: [
        6,
        [
          [0, 1],
          [1, 2],
          [3, 4],
          [4, 5],
        ],
        2,
        5,
      ],
      expected: false,
    },
    {
      input: "n = 1, edges = [], source = 0, destination = 0",
      output: "true",
      explanation: "The start is already the destination.",
      args: [1, [], 0, 0],
      expected: true,
    },
  ],
  constraints: [
    "1 ≤ n ≤ 2 × 10⁵",
    "0 ≤ edges.length ≤ 2 × 10⁵",
    "0 ≤ u, v, source, destination < n",
    "u ≠ v, and no edge appears twice",
  ],
  hints: [
    "The question is only whether the two nodes end up in the same connected group, not how far apart they are.",
    "Start every node in its own group. Each edge merges the groups of its two endpoints.",
    "Use union-find: for every edge, union its endpoints (path compression keeps finds fast). At the end, answer whether `find(source) === find(destination)`.",
  ],
  keyIdea:
    "Union-find keeps each connected component as a tree identified by its root. Processing every edge with `union(u, v)` builds the components, and two nodes are connected exactly when `find` returns the same root for both. BFS or DFS from `source` works too; union-find shines when edges keep arriving and you need to answer connectivity questions along the way.",
  complexity: { time: "O(n + E · α(n))", space: "O(n)" },
  tags: ["graph", "union-find"],
  relatedPatterns: ["graphs-bfs"],
  externalRefs: [
    { label: "LeetCode 1971", url: "https://leetcode.com/problems/find-if-path-exists-in-graph/" },
  ],
});
