import { type LevelOrder, toTree, type TreeNode } from "../_shared/tree";

function valid(node: TreeNode | null, low: number, high: number): boolean {
  if (!node) return true;
  if (node.val <= low || node.val >= high) return false;
  return valid(node.left, low, node.val) && valid(node.right, node.val, high);
}

export function solve(root: LevelOrder): boolean {
  return valid(toTree(root), -Infinity, Infinity);
}
