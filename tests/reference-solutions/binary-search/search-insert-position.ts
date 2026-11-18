export function solve(nums: number[], target: number): number {
  let low = 0;
  let high = nums.length;
  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    if (nums[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low;
}
