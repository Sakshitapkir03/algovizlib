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

/** Lower half in a max-heap, upper half in a min-heap; the lower half holds the extra item when the count is odd. */
class MedianFinder {
  private lower = new Heap<number>((a, b) => a > b);
  private upper = new Heap<number>((a, b) => a < b);

  addNum(num: number): void {
    const lowerTop = this.lower.peek();
    if (lowerTop === undefined || num <= lowerTop) this.lower.push(num);
    else this.upper.push(num);
    if (this.lower.size > this.upper.size + 1) this.upper.push(this.lower.pop() as number);
    else if (this.upper.size > this.lower.size) this.lower.push(this.upper.pop() as number);
  }

  findMedian(): number {
    const lowerTop = this.lower.peek() as number;
    if (this.lower.size > this.upper.size) return lowerTop;
    return (lowerTop + (this.upper.peek() as number)) / 2;
  }
}

export function solve(operations: string[], args: number[][]): (number | null)[] {
  let finder = new MedianFinder();
  return operations.map((op, i) => {
    switch (op) {
      case "MedianFinder":
        finder = new MedianFinder();
        return null;
      case "addNum":
        finder.addNum(args[i][0]);
        return null;
      case "findMedian":
        return finder.findMedian();
      default:
        throw new Error(`unknown operation ${op}`);
    }
  });
}
