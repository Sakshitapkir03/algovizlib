export function solve(nums: number[]): number {
  const dfs = (i: number, xor: number): number =>
    i === nums.length ? xor : dfs(i + 1, xor ^ nums[i]) + dfs(i + 1, xor);
  return dfs(0, 0);
}
