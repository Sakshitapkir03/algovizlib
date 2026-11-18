export function solve(n: number): number {
  let twoBelow = 1; // ways to reach step 0
  let oneBelow = 1; // ways to reach step 1
  for (let step = 2; step <= n; step++) {
    const current = oneBelow + twoBelow;
    twoBelow = oneBelow;
    oneBelow = current;
  }
  return oneBelow;
}
