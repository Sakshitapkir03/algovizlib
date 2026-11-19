import { defineProblem } from "@/lib/catalog";

export const shortestPathVisitingAllNodes = defineProblem({
  slug: "shortest-path-visiting-all-nodes",
  patternSlug: "bit-manipulation",
  title: "Shortest Path Visiting All Nodes",
  difficulty: "hard",
  order: 4,
  statement: `A connected, undirected graph has \`n\` nodes labeled \`0\` to \`n - 1\`. It is given as an adjacency list \`graph\`, where \`graph[i]\` lists the nodes that share an edge with node \`i\`.

A walk moves along one edge per step. You may start and stop at any node, and you may revisit nodes and reuse edges as often as you like. Return the minimum number of steps in a walk that visits every node at least once. A graph with a single node needs \`0\` steps.`,
  examples: [
    {
      input: "graph = [[1, 2, 4], [0, 2], [0, 1, 3], [2], [0]]",
      output: "4",
      explanation:
        "Start at the dead end 4 and walk 4 → 0 → 1 → 2 → 3. Every node is seen in 4 steps, with no backtracking.",
      args: [[[1, 2, 4], [0, 2], [0, 1, 3], [2], [0]]],
      expected: 4,
    },
    {
      input: "graph = [[1, 2, 3], [0], [0], [0]]",
      output: "4",
      explanation:
        "A star with center 0. Walk 1 → 0 → 2 → 0 → 3: you must pass back through the center once.",
      args: [[[1, 2, 3], [0], [0], [0]]],
      expected: 4,
    },
    {
      input: "graph = [[]]",
      output: "0",
      explanation: "The only node is visited the moment you start.",
      args: [[[]]],
      expected: 0,
    },
  ],
  constraints: [
    "1 ≤ n ≤ 12",
    "graph[i] has no duplicates and does not contain i",
    "If j is in graph[i], then i is in graph[j]",
    "The graph is connected",
  ],
  hints: [
    "Plain BFS over nodes fails because revisiting is allowed: being at node 2 having seen {0, 1, 2} is a different situation from being at node 2 having seen only {2}. What should a BFS state contain?",
    "With at most 12 nodes, the set of visited nodes fits in a 12-bit integer. A state is (current node, visited mask), and there are at most n × 2ⁿ of them.",
    "Start a multi-source BFS from every `(i, 1 << i)` at distance 0. From `(u, mask)`, step to `(v, mask | (1 << v))` for each neighbor `v`, skipping states already seen. The first time a state's mask equals `(1 << n) - 1`, its distance is the answer.",
  ],
  keyIdea:
    'Encode "which nodes have I seen" as a bitmask and run BFS over (node, mask) pairs instead of nodes. Every edge costs one step, so BFS finds the fewest steps to any state, and starting from all nodes at once handles the free choice of start. The first state whose mask has all n bits set gives the answer, after exploring at most n × 2ⁿ states.',
  complexity: { time: "O(2ⁿ × n²)", space: "O(2ⁿ × n)" },
  tags: ["graph", "bfs", "bitmask", "state space search"],
  relatedPatterns: ["graphs-bfs"],
  externalRefs: [
    {
      label: "LeetCode 847",
      url: "https://leetcode.com/problems/shortest-path-visiting-all-nodes/",
    },
  ],
});
