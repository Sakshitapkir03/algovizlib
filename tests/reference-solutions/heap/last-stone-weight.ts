/** Binary heap ordered by `before(a, b)`: true when `a` belongs closer to the root than `b`. */
class Heap<T> {
  private items: T[] = [];
  constructor(private readonly before: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  pop(): T | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop() as T;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let best = i;
        if (left < items.length && this.before(items[left], items[best])) best = left;
        if (right < items.length && this.before(items[right], items[best])) best = right;
        if (best === i) break;
        [items[i], items[best]] = [items[best], items[i]];
        i = best;
      }
    }
    return top;
  }

  values(): T[] {
    return [...this.items];
  }
}

export function solve(stones: number[]): number {
  const heap = new Heap<number>((a, b) => a > b);
  for (const stone of stones) heap.push(stone);
  while (heap.size > 1) {
    const y = heap.pop() as number;
    const x = heap.pop() as number;
    if (x !== y) heap.push(y - x);
  }
  return heap.peek() ?? 0;
}
