import { defineProblem } from "@/lib/catalog";

export const binaryTreeMaximumPathSum = defineProblem({
  slug: "binary-tree-maximum-path-sum",
  patternSlug: "trees-dfs",
  title: "Binary Tree Maximum Path Sum",
  difficulty: "hard",
  order: 4,
  statement: `Given a non-empty binary tree \`root\`, find the largest possible sum of a path and return that sum.

A path is a sequence of at least one node where each pair of neighbors is connected by an edge, and no node appears twice. It can start and end anywhere; it doesn't have to pass through the root or reach a leaf. Node values may be negative.

A tree is written in level order: values row by row, left to right, with \`null\` where a child is missing (trailing \`null\`s are left off). For example, \`[5, 2, 8, null, 4]\` is 5 with children 2 and 8, where 2 has only a right child, 4. An empty tree is \`[]\`.`,
  examples: [
    {
      input: "root = [2, -6, 5, null, null, 3, 4]",
      output: "12",
      explanation:
        "The path 3 → 5 → 4 sums to 12. Going up through the root instead (2 + 5 + 4 = 11) is worse.",
      args: [[2, -6, 5, null, null, 3, 4]],
      expected: 12,
    },
    {
      input: "root = [1, 8, 3, -20, 6]",
      output: "18",
      explanation: "The path 6 → 8 → 1 → 3 sums to 18; the -20 branch is left out.",
      args: [[1, 8, 3, -20, 6]],
      expected: 18,
    },
    {
      input: "root = [-4, -9, -2]",
      output: "-2",
      explanation: "Every value is negative, so the best path is the single node -2.",
      args: [[-4, -9, -2]],
      expected: -2,
    },
  ],
  constraints: ["1 ≤ number of nodes ≤ 3 × 10⁴", "-1000 ≤ node value ≤ 1000"],
  hints: [
    "Every path has one highest node, where it bends. Try thinking about the best path that bends at each node.",
    "For a node to extend a path to its parent, it can only use one of its children. What should each recursive call return, and when is a child's contribution better ignored?",
    "Return gain(node) = node.val + max(0, gain(left), gain(right)). While computing it, update the global best with node.val + max(0, gain(left)) + max(0, gain(right)).",
  ],
  keyIdea:
    "Each node plays two roles. As the top of a path, it can join both children's best downward chains, which is a candidate for the answer. As part of a longer path, it can hand only one chain up to its parent. Recurse to get each child's best downward gain (dropping negative gains), update the global best with the two-sided sum, and return the one-sided sum.",
  complexity: { time: "O(n)", space: "O(h)" },
  tags: ["binary-tree", "dfs", "dynamic-programming"],
  externalRefs: [
    { label: "LeetCode 124", url: "https://leetcode.com/problems/binary-tree-maximum-path-sum/" },
  ],
});
