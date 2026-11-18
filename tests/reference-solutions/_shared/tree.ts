/**
 * Binary trees appear in examples in level order with `null` for missing children, trailing nulls trimmed:
 * `[3, 9, 20, null, null, 15, 7]` is 3 with children 9 and 20, where 20 has children 15 and 7. `[]` is empty.
 */
export type TreeNode = { val: number; left: TreeNode | null; right: TreeNode | null };
export type LevelOrder = readonly (number | null)[];

export function toTree(levelOrder: LevelOrder): TreeNode | null {
  if (levelOrder.length === 0 || levelOrder[0] === null) return null;
  const root: TreeNode = { val: levelOrder[0], left: null, right: null };
  const queue: TreeNode[] = [root];
  let i = 1;
  for (let head = 0; head < queue.length && i < levelOrder.length; head++) {
    const node = queue[head];
    for (const side of ["left", "right"] as const) {
      const val = levelOrder[i++];
      if (val !== null && val !== undefined) {
        node[side] = { val, left: null, right: null };
        queue.push(node[side]);
      }
    }
  }
  return root;
}

export function fromTree(root: TreeNode | null): (number | null)[] {
  const out: (number | null)[] = [];
  const queue: (TreeNode | null)[] = [root];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    out.push(node ? node.val : null);
    if (node) queue.push(node.left, node.right);
  }
  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  return out;
}
