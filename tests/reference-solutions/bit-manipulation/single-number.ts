export function solve(nums: number[]): number {
  let acc = 0;
  for (const x of nums) acc ^= x;
  return acc;
}
