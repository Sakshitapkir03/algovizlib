function sortAndCount(a: number[]): { sorted: number[]; count: number } {
  if (a.length <= 1) return { sorted: [...a], count: 0 };
  const mid = Math.floor(a.length / 2);
  const left = sortAndCount(a.slice(0, mid));
  const right = sortAndCount(a.slice(mid));
  let count = left.count + right.count;
  const sorted: number[] = [];
  let i = 0;
  let j = 0;
  while (i < left.sorted.length && j < right.sorted.length) {
    if (left.sorted[i] <= right.sorted[j]) {
      sorted.push(left.sorted[i++]);
    } else {
      count += left.sorted.length - i;
      sorted.push(right.sorted[j++]);
    }
  }
  while (i < left.sorted.length) sorted.push(left.sorted[i++]);
  while (j < right.sorted.length) sorted.push(right.sorted[j++]);
  return { sorted, count };
}

export function solve(nums: number[]): number {
  return sortAndCount(nums).count;
}
