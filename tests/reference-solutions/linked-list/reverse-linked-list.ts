import { fromList, type ListNode, toList } from "../_shared/list";

export function solve(values: number[]): number[] {
  let prev: ListNode | null = null;
  let current = toList(values);
  while (current) {
    const next: ListNode | null = current.next;
    current.next = prev;
    prev = current;
    current = next;
  }
  return fromList(prev);
}
