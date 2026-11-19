export function solve(input: number[]): boolean {
  const nums = [...input];
  const n = nums.length;
  const next = (i: number) => (((i + nums[i]) % n) + n) % n;

  for (let start = 0; start < n; start++) {
    if (nums[start] === 0) continue;
    const forward = nums[start] > 0;
    // A move from i is allowed if i is still live, keeps the direction, and isn't a self-loop.
    const step = (i: number): number => {
      if (nums[i] === 0 || nums[i] > 0 !== forward) return -1;
      const j = next(i);
      if (j === i || nums[j] === 0 || nums[j] > 0 !== forward) return -1;
      return j;
    };
    let slow = start;
    let fast = start;
    for (;;) {
      slow = step(slow);
      const mid = step(fast);
      fast = mid === -1 ? -1 : step(mid);
      if (slow === -1 || fast === -1) break;
      if (slow === fast) return true;
    }
    // Dead end: zero out the same-direction path from start so it's never walked again.
    let i = start;
    while (nums[i] !== 0 && nums[i] > 0 === forward) {
      const j = next(i);
      nums[i] = 0;
      i = j;
    }
  }
  return false;
}
