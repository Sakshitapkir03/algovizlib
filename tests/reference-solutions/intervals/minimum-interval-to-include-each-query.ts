/** Min-heap of [size, right] pairs, ordered by size. */
class MinHeap {
  private items: [number, number][] = [];

  get size(): number {
    return this.items.length;
  }

  peek(): [number, number] | undefined {
    return this.items[0];
  }

  push(item: [number, number]): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent][0] <= a[i][0]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }

  pop(): void {
    const a = this.items;
    const last = a.pop();
    if (!last || a.length === 0) return;
    a[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (l < a.length && a[l][0] < a[smallest][0]) smallest = l;
      if (r < a.length && a[r][0] < a[smallest][0]) smallest = r;
      if (smallest === i) break;
      [a[smallest], a[i]] = [a[i], a[smallest]];
      i = smallest;
    }
  }
}

export function solve(intervals: number[][], queries: number[]): number[] {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const order = queries.map((_, j) => j).sort((a, b) => queries[a] - queries[b]);
  const answer = new Array<number>(queries.length).fill(-1);
  const heap = new MinHeap();
  let i = 0;
  for (const j of order) {
    const q = queries[j];
    while (i < sorted.length && sorted[i][0] <= q) {
      const [left, right] = sorted[i++];
      heap.push([right - left + 1, right]);
    }
    while (heap.size > 0 && (heap.peek() as [number, number])[1] < q) heap.pop();
    const top = heap.peek();
    if (top) answer[j] = top[0];
  }
  return answer;
}
