export function solve(money: number[]): number {
  let skipPrev = 0; // best total up to two houses back
  let best = 0; // best total up to the previous house
  for (const cash of money) {
    const next = Math.max(best, skipPrev + cash);
    skipPrev = best;
    best = next;
  }
  return best;
}
