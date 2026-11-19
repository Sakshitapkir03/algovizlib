const OFFSET = 50;

export function solve(nums: number[]): number[] {
  const count = new Array<number>(2 * OFFSET + 1).fill(0);
  for (const v of nums) count[v + OFFSET]++;
  const out: number[] = [];
  for (let k = 0; k < count.length; k++) {
    for (let c = 0; c < count[k]; c++) out.push(k - OFFSET);
  }
  return out;
}
