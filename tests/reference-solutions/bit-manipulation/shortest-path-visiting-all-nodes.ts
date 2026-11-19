export function solve(graph: number[][]): number {
  const n = graph.length;
  const full = (1 << n) - 1;
  if (n === 1) return 0;
  const seen = Array.from({ length: n }, () => new Uint8Array(1 << n));
  let frontier: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    seen[i][1 << i] = 1;
    frontier.push([i, 1 << i]);
  }
  let steps = 0;
  while (frontier.length > 0) {
    steps++;
    const next: [number, number][] = [];
    for (const [u, mask] of frontier) {
      for (const v of graph[u]) {
        const m = mask | (1 << v);
        if (m === full) return steps;
        if (seen[v][m]) continue;
        seen[v][m] = 1;
        next.push([v, m]);
      }
    }
    frontier = next;
  }
  return -1;
}
