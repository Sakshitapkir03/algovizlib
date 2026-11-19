type Node = { val: number; next: Node | null };

function build(values: number[], pos: number): Node | null {
  const nodes: Node[] = values.map((val) => ({ val, next: null }));
  for (let i = 0; i + 1 < nodes.length; i++) nodes[i].next = nodes[i + 1];
  if (pos >= 0 && nodes.length > 0) nodes[nodes.length - 1].next = nodes[pos];
  return nodes[0] ?? null;
}

export function solve(values: number[], pos: number): boolean {
  const head = build(values, pos);
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = (slow as Node).next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
