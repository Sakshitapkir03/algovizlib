import { defineProblem } from "@/lib/catalog";

export const validateBinarySearchTree = defineProblem({
  slug: "validate-binary-search-tree",
  patternSlug: "trees-dfs",
  title: "Validate a Binary Search Tree",
  difficulty: "medium",
  order: 2,
  statement: `Given a binary tree \`root\`, return \`true\` if it is a valid binary search tree and \`false\` otherwise.

A tree is a valid binary search tree when, for every node, every value in its left subtree is strictly smaller than the node's value and every value in its right subtree is strictly larger. Equal values are not allowed. An empty tree counts as valid.

A tree is written in level order: values row by row, left to right, with \`null\` where a child is missing (trailing \`null\`s are left off). For example, \`[5, 2, 8, null, 4]\` is 5 with children 2 and 8, where 2 has only a right child, 4. An empty tree is \`[]\`.`,
  examples: [
    {
      input: "root = [10, 5, 15, 3, 7, 12, 20]",
      output: "true",
      explanation: "Every node's left side is smaller and right side is larger, all the way down.",
      args: [[10, 5, 15, 3, 7, 12, 20]],
      expected: true,
    },
    {
      input: "root = [10, 5, 15, 3, 12]",
      output: "false",
      explanation:
        "12 is a fine right child of 5, but it sits in the left subtree of 10, where every value must be smaller than 10.",
      args: [[10, 5, 15, 3, 12]],
      expected: false,
    },
    {
      input: "root = [4, 4]",
      output: "false",
      explanation: "The left child equals its parent, and the ordering must be strict.",
      args: [[4, 4]],
      expected: false,
    },
  ],
  constraints: ["0 ≤ number of nodes ≤ 10⁴", "-2³¹ ≤ node value ≤ 2³¹ - 1"],
  hints: [
    "Comparing each node only with its own children isn't enough. Look at the second example: which ancestor does 12 break the rule for?",
    "Every node must fit inside a range set by its ancestors. When you go left, which end of the range changes? When you go right?",
    "Recurse with (node, low, high), starting unbounded. Fail if node.val isn't strictly between them; go left with (low, node.val) and right with (node.val, high).",
  ],
  keyIdea:
    "Each node has to lie in an open interval set by all of its ancestors, not just its parent. Pass that interval down: going left tightens the upper bound to the current value, going right tightens the lower bound. If any node falls outside its interval, the tree is invalid.",
  complexity: { time: "O(n)", space: "O(h)" },
  tags: ["binary-tree", "bst", "dfs"],
  externalRefs: [{ label: "LeetCode 98", url: "https://leetcode.com/problems/validate-binary-search-tree/" }],
});
