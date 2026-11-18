export function solve(a: string, b: string): number {
  // prev[j] = LCS length of a[0..i) and b[0..j) for the previous i.
  let prev: number[] = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    }
    prev = curr;
  }
  return prev[b.length];
}
