import { defineProblem } from "@/lib/catalog";

export const redundantConnection = defineProblem({
  slug: "redundant-connection",
  patternSlug: "advanced-graphs",
  title: "Redundant Connection",
  difficulty: "medium",
  order: 3,
  statement: `A tree is an undirected graph that is connected and has no cycles. Someone started with a tree on \`n\` nodes labeled \`1\` to \`n\`, then added one extra edge between two different nodes that were not already directly connected.

The resulting \`n\` edges are given as \`edges\`, where \`edges[i] = [a, b]\`. Return an edge you can delete so that the remaining edges form a tree on all \`n\` nodes. If more than one edge would work, return the one that appears last in \`edges\`. Return it as \`[a, b]\`, exactly as written in the input.`,
  examples: [
    {
      input: "edges = [[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]]",
      output: "[1, 4]",
      explanation:
        "Edges 1-2, 2-3, 3-4, and 1-4 form a loop. Removing any of them leaves a tree; 1-4 appears last of the four.",
      args: [
        [
          [1, 2],
          [2, 3],
          [3, 4],
          [1, 4],
          [1, 5],
        ],
      ],
      expected: [1, 4],
    },
    {
      input: "edges = [[2, 3], [1, 3], [1, 2]]",
      output: "[1, 2]",
      explanation:
        "The smallest possible case: a triangle. Any edge breaks the cycle, so the last one listed is the answer.",
      args: [
        [
          [2, 3],
          [1, 3],
          [1, 2],
        ],
      ],
      expected: [1, 2],
    },
    {
      input: "edges = [[1, 2], [2, 3], [3, 1], [3, 4]]",
      output: "[3, 1]",
      explanation:
        "Edge 3-4 is the last edge overall, but removing it disconnects node 4. Of the loop 1-2-3, edge [3, 1] comes last.",
      args: [
        [
          [1, 2],
          [2, 3],
          [3, 1],
          [3, 4],
        ],
      ],
      expected: [3, 1],
    },
  ],
  constraints: [
    "3 ≤ n ≤ 1000, and edges.length = n",
    "1 ≤ a, b ≤ n, a ≠ b",
    "No edge repeats, and the edges connect all n nodes",
  ],
  hints: [
    "Only edges on the single cycle can be removed. Which cycle edge appears last in the list?",
    "Add edges one at a time, tracking which nodes are already connected. What is special about the first edge whose endpoints are already connected?",
    "Use union-find. For each edge in order, if `find(a) === find(b)` the edge closes the cycle, so return it; otherwise `union(a, b)`.",
  ],
  keyIdea:
    "A tree plus one edge has exactly one cycle. Adding edges in input order with union-find, every edge joins two separate components until the one that closes the cycle, whose endpoints already share a root. All other cycle edges came earlier, so this edge is the cycle edge that appears last, which is exactly the required answer.",
  complexity: { time: "O(n · α(n))", space: "O(n)" },
  tags: ["graph", "union-find", "cycle detection"],
  externalRefs: [{ label: "LeetCode 684", url: "https://leetcode.com/problems/redundant-connection/" }],
});
