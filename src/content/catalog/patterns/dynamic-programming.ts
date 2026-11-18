import { definePattern } from "@/lib/catalog";

export const dynamicProgrammingPattern = definePattern({
  slug: "dynamic-programming",
  categorySlug: "dsa",
  name: "Dynamic Programming",
  summary:
    "Break a problem into smaller overlapping subproblems, solve each one once, and build the final answer from a table of stored results.",
  whenToUse: [
    "count the ways / find the min or max over many choices",
    "the answer for a size depends on answers for smaller sizes",
    "plain recursion recomputes the same calls again and again",
    "comparing two strings or sequences prefix by prefix",
  ],
  coreIdea:
    "Many brute-force searches branch into the same smaller questions over and over. If the best answer to a big question can be assembled from the answers to a few smaller ones (optimal substructure), you only need to solve each smaller question once. Define what a single table cell means, write how it follows from earlier cells, fill the table in an order where those cells are already known, and read the answer from the last cell. Exponential work collapses to the number of cells times the work per cell, and often you only need to keep the last row or two.",
  typicalComplexity: {
    time: "O(number of states × choices per state)",
    space: "O(number of states), often reducible",
  },
  order: 7,
});
