import { fromList, type ListNode, toList } from "../_shared/list";

export function solve(values: number[]): number[] {
  const head = toList(values);
  if (!head) return [];

  // Find the end of the first half (the middle for odd lengths).
  let slow: ListNode = head;
  let fast: ListNode = head;
  while (fast.next && fast.next.next) {
    slow = slow.next!;
    fast = fast.next.next;
  }

  // Cut and reverse the second half.
  let current = slow.next;
  slow.next = null;
  let back: ListNode | null = null;
  while (current) {
    const next: ListNode | null = current.next;
    current.next = back;
    back = current;
    current = next;
  }

  // Weave the halves together.
  let front: ListNode | null = head;
  while (front && back) {
    const frontNext: ListNode | null = front.next;
    const backNext: ListNode | null = back.next;
    front.next = back;
    back.next = frontNext;
    front = frontNext;
    back = backNext;
  }
  return fromList(head);
}
