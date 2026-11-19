function merge(left: number[], right: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) out.push(left[i++]);
    else out.push(right[j++]);
  }
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);
  return out;
}

export function solve(nums: number[]): number[] {
  if (nums.length <= 1) return [...nums];
  const mid = Math.floor(nums.length / 2);
  return merge(solve(nums.slice(0, mid)), solve(nums.slice(mid)));
}
