import type { TraceHeap, TraceHeapItem } from "../types";

/**
 * A binary heap the traces drive exactly like the reference solutions' `Heap` (same sift order, same tie rules),
 * recording each push's or pop's swaps for the video. `snapshot()` reports the heap and this step's operation, then
 * clears the operation.
 */
export class RecordedHeap {
  readonly items: TraceHeapItem[] = [];
  private swaps: [number, number][] = [];
  private pushed: TraceHeapItem | undefined;
  private popped: TraceHeapItem | undefined;

  constructor(
    readonly kind: "min" | "max",
    readonly capacity?: number,
  ) {}

  /** True when `a` belongs closer to the root than `b`. */
  private before(a: TraceHeapItem, b: TraceHeapItem): boolean {
    return this.kind === "min" ? a.key < b.key : a.key > b.key;
  }

  get size(): number {
    return this.items.length;
  }

  peek(): TraceHeapItem | undefined {
    return this.items[0];
  }

  private swap(i: number, j: number) {
    [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    this.swaps.push([i, j]);
  }

  push(item: TraceHeapItem) {
    this.items.push(item);
    this.pushed = item;
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(this.items[i], this.items[parent])) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): TraceHeapItem | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    this.popped = top;
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let best = i;
        if (left < this.items.length && this.before(this.items[left], this.items[best])) best = left;
        if (right < this.items.length && this.before(this.items[right], this.items[best])) best = right;
        if (best === i) break;
        this.swap(i, best);
        i = best;
      }
    }
    return top;
  }

  /** The heap now, with this step's operation; then forget the operation. */
  snapshot(): TraceHeap {
    const heap: TraceHeap = {
      kind: this.kind,
      items: this.items.map((item) => ({ ...item })),
      ...(this.capacity !== undefined ? { capacity: this.capacity } : {}),
      ...(this.swaps.length > 0 ? { swaps: this.swaps } : {}),
      ...(this.pushed ? { pushed: { ...this.pushed } } : {}),
      ...(this.popped ? { popped: { ...this.popped } } : {}),
    };
    this.swaps = [];
    this.pushed = undefined;
    this.popped = undefined;
    return heap;
  }
}
