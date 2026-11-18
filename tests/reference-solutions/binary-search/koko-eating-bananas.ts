export function solve(piles: number[], h: number): number {
  let low = 1;
  let high = Math.max(...piles);
  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    let hours = 0;
    for (const pile of piles) hours += Math.ceil(pile / mid);
    if (hours <= h) high = mid;
    else low = mid + 1;
  }
  return low;
}
