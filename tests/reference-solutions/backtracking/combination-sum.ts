export function solve(candidates: number[], target: number): number[][] {
  const sorted = [...candidates].sort((a, b) => a - b);
  const result: number[][] = [];
  const current: number[] = [];
  const dfs = (start: number, remaining: number): void => {
    if (remaining === 0) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < sorted.length; i++) {
      if (sorted[i] > remaining) break;
      current.push(sorted[i]);
      dfs(i, remaining - sorted[i]);
      current.pop();
    }
  };
  dfs(0, target);
  return result;
}
