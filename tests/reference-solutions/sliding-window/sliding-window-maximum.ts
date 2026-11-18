export function solve(nums: number[], k: number): number[] {
  const deque: number[] = [];
  let head = 0;
  const result: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    while (deque.length > head && nums[deque[deque.length - 1]] <= nums[i]) deque.pop();
    deque.push(i);
    if (deque[head] <= i - k) head++;
    if (i >= k - 1) result.push(nums[deque[head]]);
  }
  return result;
}
