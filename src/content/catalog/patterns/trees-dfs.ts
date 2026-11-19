import { definePattern } from "@/lib/catalog";

export const treesDfsPattern = definePattern({
  slug: "trees-dfs",
  categorySlug: "dsa",
  group: "trees-graphs",
  name: "Trees (DFS)",
  summary:
    "Solve a tree problem by recursing into each child, then combining what the children report with the current node. Information can flow down (from root to leaves) or up (from leaves to root).",
  whenToUse: [
    "binary tree + a question about every root-to-leaf path",
    "the answer for a node depends on answers for its subtrees",
    "need to carry a running value (sum, max, bounds) from the root down",
    "height, depth, or best-path style questions",
  ],
  coreIdea:
    "A tree is a node plus two smaller trees, so most questions split the same way: solve the left subtree, solve the right subtree, and combine. Depth-first search visits each node once, either passing state down as arguments (a running sum, the largest value seen, the allowed range) or returning a summary up from each child (a height, a best gain). Because each node is handled exactly once and the recursion only remembers the current path, the work is linear and the extra memory is the tree's height.",
  typicalComplexity: { time: "O(n)", space: "O(h), h = tree height" },
  order: 12,
});
