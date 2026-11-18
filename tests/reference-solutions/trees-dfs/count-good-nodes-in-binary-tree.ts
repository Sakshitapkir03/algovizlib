import { type LevelOrder, toTree, type TreeNode } from "../_shared/tree";

function count(node: TreeNode | null, maxSoFar: number): number {
  if (!node) return 0;
  const good = node.val >= maxSoFar ? 1 : 0;
  const nextMax = Math.max(maxSoFar, node.val);
  return good + count(node.left, nextMax) + count(node.right, nextMax);
}

export function solve(root: LevelOrder): number {
  return count(toTree(root), -Infinity);
}
