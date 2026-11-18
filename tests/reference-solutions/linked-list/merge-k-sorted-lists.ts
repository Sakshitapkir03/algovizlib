import { fromList, type ListNode, toList } from "../_shared/list";

function mergeTwo(a: ListNode | null, b: ListNode | null): ListNode | null {
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
  return dummy.next;
}

/** Divide and conquer: merge lists in pairs, halving the count each round. */
export function solve(lists: number[][]): number[] {
  let heads = lists.map((values) => toList(values));
  if (heads.length === 0) return [];
  while (heads.length > 1) {
    const merged: (ListNode | null)[] = [];
    for (let i = 0; i < heads.length; i += 2) merged.push(mergeTwo(heads[i], heads[i + 1] ?? null));
    heads = merged;
  }
  return fromList(heads[0]);
}
