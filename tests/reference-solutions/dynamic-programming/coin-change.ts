export function solve(coins: number[], amount: number): number {
  const fewest: number[] = new Array<number>(amount + 1).fill(Infinity);
  fewest[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const coin of coins) {
      if (coin <= a && fewest[a - coin] + 1 < fewest[a]) fewest[a] = fewest[a - coin] + 1;
    }
  }
  return fewest[amount] === Infinity ? -1 : fewest[amount];
}
