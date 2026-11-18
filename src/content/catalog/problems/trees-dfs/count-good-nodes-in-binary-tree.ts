import { defineProblem } from "@/lib/catalog";

export const countGoodNodesInBinaryTree = defineProblem({
  slug: "count-good-nodes-in-binary-tree",
  patternSlug: "trees-dfs",
  title: "Count Good Nodes",
  difficulty: "medium",
  order: 3,
  statement: `Given a non-empty binary tree \`root\`, call a node good if no value on the path from the root down to that node (including the root) is greater than the node's own value. Ties are fine, and the root is always good.

Return the number of good nodes in the tree.

A tree is written in level order: values row by row, left to right, with \`null\` where a child is missing (trailing \`null\`s are left off). For example, \`[5, 2, 8, null, 4]\` is 5 with children 2 and 8, where 2 has only a right child, 4. An empty tree is \`[]\`.`,
  examples: [
    {
      input: "root = [4, 2, 6, 5, 1, 3, 8]",
      output: "4",
      explanation:
        "4 (the root), 6, 8, and 5 are good. 5 counts because its path is 4 → 2 → 5 and nothing above it is larger. 2, 1, and 3 each have a larger value above them.",
      args: [[4, 2, 6, 5, 1, 3, 8]],
      expected: 4,
    },
    {
      input: "root = [7, 7, 7]",
      output: "3",
      explanation: "Equal values don't disqualify a node, so all three are good.",
      args: [[7, 7, 7]],
      expected: 3,
    },
    {
      input: "root = [-2]",
      output: "1",
      explanation: "The root is always good.",
      args: [[-2]],
      expected: 1,
    },
  ],
  constraints: ["1 ≤ number of nodes ≤ 10⁵", "-10⁴ ≤ node value ≤ 10⁴"],
  hints: [
    "To decide whether a node is good, you don't need the whole path above it. What single number would be enough?",
    "Pass the largest value seen so far down the recursion. How do you update it as you step into a child?",
    "DFS with (node, maxSoFar): count 1 if node.val ≥ maxSoFar, then recurse into both children with max(maxSoFar, node.val) and add up the counts.",
  ],
  keyIdea:
    "A node is good exactly when its value is at least the maximum on the path above it, so carry that running maximum down the DFS. Each node compares itself once, updates the maximum, and hands it to its children.",
  complexity: { time: "O(n)", space: "O(h)" },
  tags: ["binary-tree", "dfs"],
  externalRefs: [
    { label: "LeetCode 1448", url: "https://leetcode.com/problems/count-good-nodes-in-binary-tree/" },
  ],
});
