export function solve(source: string, target: string): number {
  // prev[j] = edits to turn source[0..i) into target[0..j) for the previous i.
  let prev: number[] = Array.from({ length: target.length + 1 }, (_, j) => j);
  for (let i = 1; i <= source.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= target.length; j++) {
      curr[j] =
        source[i - 1] === target[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[target.length];
}
