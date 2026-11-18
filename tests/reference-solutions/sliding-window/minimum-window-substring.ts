export function solve(s: string, t: string): string {
  const need = new Map<string, number>();
  for (const ch of t) need.set(ch, (need.get(ch) ?? 0) + 1);
  let missing = t.length;
  let left = 0;
  let bestStart = 0;
  let bestLen = Infinity;
  for (let right = 0; right < s.length; right++) {
    const r = s[right];
    const nr = need.get(r);
    if (nr !== undefined) {
      if (nr > 0) missing--;
      need.set(r, nr - 1);
    }
    while (missing === 0) {
      if (right - left + 1 < bestLen) {
        bestLen = right - left + 1;
        bestStart = left;
      }
      const l = s[left];
      const nl = need.get(l);
      if (nl !== undefined) {
        need.set(l, nl + 1);
        if (nl + 1 > 0) missing++;
      }
      left++;
    }
  }
  return bestLen === Infinity ? "" : s.slice(bestStart, bestStart + bestLen);
}
