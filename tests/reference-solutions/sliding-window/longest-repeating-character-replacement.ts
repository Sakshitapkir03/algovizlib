export function solve(s: string, k: number): number {
  const counts = new Map<string, number>();
  let left = 0;
  let maxCount = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    const c = (counts.get(s[right]) ?? 0) + 1;
    counts.set(s[right], c);
    maxCount = Math.max(maxCount, c);
    while (right - left + 1 - maxCount > k) {
      counts.set(s[left], (counts.get(s[left]) ?? 0) - 1);
      left++;
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}
