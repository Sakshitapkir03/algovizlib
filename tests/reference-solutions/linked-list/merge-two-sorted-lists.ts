import { fromList, type ListNode, toList } from "../_shared/list";

export function solve(aValues: number[], bValues: number[]): number[] {
  let a = toList(aValues);
  let b = toList(bValues);
  const dummy: ListNode = { val: 0, next: null };
  let tail = dummy;
  while (a && b) {
    if (a.val <= b.val) {
      tail.next = a;
      a = a.next;
    } else {
      tail.next = b;
      b = b.next;
    }
    tail = tail.next;
  }
  tail.next = a ?? b;
  return fromList(dummy.next);
}
