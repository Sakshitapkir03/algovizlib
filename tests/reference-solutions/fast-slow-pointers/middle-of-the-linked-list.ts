import { fromList, toList } from "../_shared/list";

export function solve(values: number[]): number[] {
  const head = toList(values);
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow?.next ?? null;
    fast = fast.next.next;
  }
  return fromList(slow);
}
