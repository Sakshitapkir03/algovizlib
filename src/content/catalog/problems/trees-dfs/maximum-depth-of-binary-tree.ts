import { defineProblem } from "@/lib/catalog";

export const maximumDepthOfBinaryTree = defineProblem({
  slug: "maximum-depth-of-binary-tree",
  patternSlug: "trees-dfs",
  title: "Maximum Depth of a Binary Tree",
  difficulty: "easy",
  order: 0,
  statement: `Given the root of a binary tree \`root\`, return its depth: the number of nodes on the longest path from the root down to any leaf. An empty tree has depth 0.

A tree is written in level order: values row by row, left to right, with \`null\` where a child is missing (trailing \`null\`s are left off). For example, \`[5, 2, 8, null, 4]\` is 5 with children 2 and 8, where 2 has only a right child, 4. An empty tree is \`[]\`.`,
  examples: [
    {
      input: "root = [5, 2, 8, null, 4, 7, 9, null, null, 1]",
      output: "4",
      explanation: "The longest path is 5 → 2 → 4 → 1, which has 4 nodes.",
      args: [[5, 2, 8, null, 4, 7, 9, null, null, 1]],
      expected: 4,
    },
    {
      input: "root = [11]",
      output: "1",
      explanation: "A single node is a path of length 1.",
      args: [[11]],
      expected: 1,
    },
    {
      input: "root = []",
      output: "0",
      explanation: "An empty tree has no nodes.",
      args: [[]],
      expected: 0,
    },
  ],
  constraints: ["0 ≤ number of nodes ≤ 10⁴", "-100 ≤ node value ≤ 100"],
  hints: [
    "If you already knew the depth of the left subtree and of the right subtree, could you get the depth of the whole tree?",
    "The depth of a node is 1 plus the larger of its children's depths. What's the depth of a missing child?",
    "Recurse: return 0 for an empty node, otherwise 1 + max(depth(left), depth(right)).",
  ],
  keyIdea:
    "Depth is defined recursively: an empty tree has depth 0, and any other tree is one node taller than its deeper subtree. A post-order DFS computes each subtree's depth and passes it up, visiting every node once.",
  complexity: { time: "O(n)", space: "O(h)" },
  tags: ["binary-tree", "recursion", "dfs"],
  externalRefs: [
    { label: "LeetCode 104", url: "https://leetcode.com/problems/maximum-depth-of-binary-tree/" },
  ],
});
