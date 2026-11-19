function siftDown(a: number[], i: number, size: number): void {
  for (;;) {
    const l = 2 * i + 1;
    const r = l + 1;
    let largest = i;
    if (l < size && a[l] > a[largest]) largest = l;
    if (r < size && a[r] > a[largest]) largest = r;
    if (largest === i) return;
    [a[i], a[largest]] = [a[largest], a[i]];
    i = largest;
  }
}

export function solve(nums: number[]): number[] {
  const a = [...nums];
  const n = a.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) siftDown(a, i, n);
  for (let end = n - 1; end > 0; end--) {
    [a[0], a[end]] = [a[end], a[0]];
    siftDown(a, 0, end);
  }
  return a;
}
