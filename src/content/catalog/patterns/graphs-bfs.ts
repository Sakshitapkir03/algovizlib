import { definePattern } from "@/lib/catalog";

export const graphsBfsPattern = definePattern({
  slug: "graphs-bfs",
  categorySlug: "dsa",
  group: "trees-graphs",
  name: "Graphs (BFS)",
  summary:
    "Explore a graph or grid outward from a starting point one layer at a time using a queue. It finds connected regions and the fewest steps between states when every move costs the same.",
  whenToUse: [
    "fewest moves / shortest path with equal-cost steps",
    "grid of cells + spread to neighbors",
    "count or fill connected regions",
    "several starting points spreading at the same time",
    "states that change one small edit at a time",
  ],
  coreIdea:
    "A queue hands out cells in the order they were discovered, so everything one step away is processed before anything two steps away. That means the first time you reach a cell, you reached it by a shortest route, and you never need to revisit it. Marking cells as visited when you enqueue them keeps every cell in the queue at most once, so the whole search touches each node and edge a single time. Seeding the queue with several sources at once makes them all spread in lockstep, which is how you measure simultaneous processes.",
  typicalComplexity: { time: "O(V + E)", space: "O(V)" },
  order: 13,
});
