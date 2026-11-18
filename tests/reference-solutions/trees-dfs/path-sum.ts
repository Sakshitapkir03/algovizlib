import { type LevelOrder, toTree, type TreeNode } from "../_shared/tree";

function has(node: TreeNode | null, remaining: number): boolean {
  if (!node) return false;
  const rest = remaining - node.val;
  if (!node.left && !node.right) return rest === 0;
  return has(node.left, rest) || has(node.right, rest);
}

export function solve(root: LevelOrder, target: number): boolean {
  return has(toTree(root), target);
}
