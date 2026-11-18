import { type LevelOrder, toTree, type TreeNode } from "../_shared/tree";

function depth(node: TreeNode | null): number {
  if (!node) return 0;
  return 1 + Math.max(depth(node.left), depth(node.right));
}

export function solve(root: LevelOrder): number {
  return depth(toTree(root));
}
