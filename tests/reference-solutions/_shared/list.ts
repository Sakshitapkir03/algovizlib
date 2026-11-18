/** Linked lists appear in examples as plain arrays: `[1, 2, 3]` is 1 → 2 → 3, `[]` is an empty list. */
export type ListNode = { val: number; next: ListNode | null };

export function toList(values: readonly number[]): ListNode | null {
  let head: ListNode | null = null;
  for (let i = values.length - 1; i >= 0; i--) head = { val: values[i], next: head };
  return head;
}

export function fromList(head: ListNode | null): number[] {
  const values: number[] = [];
  for (let node = head; node; node = node.next) values.push(node.val);
  return values;
}
