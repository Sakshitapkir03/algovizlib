import { type LevelOrder, toTree, type TreeNode } from "../_shared/tree";

export function solve(root: LevelOrder): number {
  let best = -Infinity;
  const gain = (node: TreeNode | null): number => {
    if (!node) return 0;
    const left = Math.max(0, gain(node.left));
    const right = Math.max(0, gain(node.right));
    best = Math.max(best, node.val + left + right);
    return node.val + Math.max(left, right);
  };
  gain(toTree(root));
  return best;
}
