export function solve(nums: number[]): number {
  const total = nums.reduce((a, b) => a + b, 0);
  let left = 0;
  for (let p = 0; p < nums.length; p++) {
    if (left === total - left - nums[p]) return p;
    left += nums[p];
  }
  return -1;
}
