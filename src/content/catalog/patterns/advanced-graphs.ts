import { definePattern } from "@/lib/catalog";

export const advancedGraphsPattern = definePattern({
  slug: "advanced-graphs",
  categorySlug: "dsa",
  group: "trees-graphs",
  name: "Advanced Graphs",
  summary:
    "Three tools for graphs that plain BFS can't handle: topological sort for ordering with dependencies, Dijkstra for shortest paths with weighted edges, and union-find for tracking which nodes are connected as edges arrive.",
  whenToUse: [
    "tasks with prerequisites + find a valid order or detect a cycle",
    "shortest path or earliest arrival with non-negative edge weights",
    "edges arrive one at a time + ask whether two nodes are already connected",
    "an ordering hidden in pairwise comparisons",
  ],
  coreIdea:
    "Each tool keeps one invariant that makes a greedy step safe. Topological sort (Kahn's algorithm) only removes a node once every edge pointing into it is gone, so nothing is placed before something it depends on; if nodes remain that can never reach in-degree zero, they sit on a cycle. Dijkstra always settles the unsettled node with the smallest tentative distance; with non-negative weights no later path can be shorter, so that distance is final. Union-find stores each component as a tree with one root, so two nodes are connected exactly when they share a root, and path compression plus union by size keep those trees almost flat, making each operation nearly constant time.",
  typicalComplexity: { time: "O(V + E) to O((V + E) log V)", space: "O(V + E)" },
  order: 16,
});
