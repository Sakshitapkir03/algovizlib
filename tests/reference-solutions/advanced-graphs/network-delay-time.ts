/** Binary min-heap of [time, node] pairs ordered by time. */
class MinHeap {
  private items: [number, number][] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: [number, number]): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.items;
    const top = a[0];
    const last = a.pop() as [number, number];
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export function solve(times: number[][], n: number, k: number): number {
  const adj: [number, number][][] = Array.from({ length: n + 1 }, () => []);
  for (const [u, v, w] of times) adj[u].push([v, w]);
  const settled = new Array<boolean>(n + 1).fill(false);
  const heap = new MinHeap();
  heap.push([0, k]);
  let count = 0;
  let latest = 0;
  while (heap.size > 0) {
    const [time, node] = heap.pop();
    if (settled[node]) continue;
    settled[node] = true;
    count++;
    latest = time;
    for (const [v, w] of adj[node]) if (!settled[v]) heap.push([time + w, v]);
  }
  return count === n ? latest : -1;
}
