import { fromList, type ListNode, toList } from "../_shared/list";

export function solve(values: number[], n: number): number[] {
  const dummy: ListNode = { val: 0, next: toList(values) };
  let fast: ListNode = dummy;
  let slow: ListNode = dummy;
  for (let i = 0; i < n; i++) fast = fast.next!;
  while (fast.next) {
    fast = fast.next;
    slow = slow.next!;
  }
  slow.next = slow.next!.next;
  return fromList(dummy.next);
}
