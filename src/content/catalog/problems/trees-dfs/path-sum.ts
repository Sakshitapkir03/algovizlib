import { defineProblem } from "@/lib/catalog";

export const pathSum = defineProblem({
  slug: "path-sum",
  patternSlug: "trees-dfs",
  title: "Path Sum",
  difficulty: "easy",
  order: 1,
  statement: `Given a binary tree \`root\` and a number \`target\`, return \`true\` if some path that starts at the root and ends at a leaf (a node with no children) has values adding up to exactly \`target\`. Otherwise return \`false\`. An empty tree has no paths, so the answer is \`false\`.

A tree is written in level order: values row by row, left to right, with \`null\` where a child is missing (trailing \`null\`s are left off). For example, \`[5, 2, 8, null, 4]\` is 5 with children 2 and 8, where 2 has only a right child, 4. An empty tree is \`[]\`.`,
  examples: [
    {
      input: "root = [6, 3, 9, 1, 4, null, 2], target = 13",
      output: "true",
      explanation: "The path 6 → 3 → 4 adds up to 13.",
      args: [[6, 3, 9, 1, 4, null, 2], 13],
      expected: true,
    },
    {
      input: "root = [6, 3, 9, 1, 4, null, 2], target = 15",
      output: "false",
      explanation:
        "The root-to-leaf sums are 10, 13, and 17. 6 + 9 = 15, but 9 isn't a leaf, so that path doesn't count.",
      args: [[6, 3, 9, 1, 4, null, 2], 15],
      expected: false,
    },
    {
      input: "root = [], target = 0",
      output: "false",
      explanation: "An empty tree has no root-to-leaf paths.",
      args: [[], 0],
      expected: false,
    },
  ],
  constraints: ["0 ≤ number of nodes ≤ 5000", "-1000 ≤ node value ≤ 1000", "-10⁶ ≤ target ≤ 10⁶"],
  hints: [
    "As you walk down from the root, what do you still need the rest of the path to add up to?",
    "Subtract each node's value from the target as you go down. What should be true when you reach a leaf?",
    "Recurse with target - node.val. At a leaf, check whether the remainder is 0; otherwise return true if either child's call does.",
  ],
  keyIdea:
    "Carry the remaining amount down the tree: each node subtracts its value before passing it to its children. A path works exactly when a leaf receives a remainder equal to its own value. Only check at leaves, since a partial path that hits the target early doesn't count.",
  complexity: { time: "O(n)", space: "O(h)" },
  tags: ["binary-tree", "dfs", "path"],
  externalRefs: [{ label: "LeetCode 112", url: "https://leetcode.com/problems/path-sum/" }],
});
