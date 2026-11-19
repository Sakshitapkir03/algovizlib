function partition(a: number[], lo: number, hi: number): number {
  const p = lo + Math.floor(Math.random() * (hi - lo + 1));
  [a[p], a[hi]] = [a[hi], a[p]];
  const pivot = a[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (a[j] < pivot) {
      [a[i], a[j]] = [a[j], a[i]];
      i++;
    }
  }
  [a[i], a[hi]] = [a[hi], a[i]];
  return i;
}

function quickSort(a: number[], lo: number, hi: number): void {
  if (lo >= hi) return;
  const p = partition(a, lo, hi);
  quickSort(a, lo, p - 1);
  quickSort(a, p + 1, hi);
}

export function solve(nums: number[]): number[] {
  const a = [...nums];
  quickSort(a, 0, a.length - 1);
  return a;
}
