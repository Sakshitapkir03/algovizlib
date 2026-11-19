export function solve(nums: number[]): number[][] {
  const result: number[][] = [];
  const current: number[] = [];
  const dfs = (i: number): void => {
    if (i === nums.length) {
      result.push([...current]);
      return;
    }
    current.push(nums[i]);
    dfs(i + 1);
    current.pop();
    dfs(i + 1);
  };
  dfs(0);
  return result;
}
