export function solve(n: number, edges: number[][], source: number, destination: number): boolean {
  const parent = Array.from({ length: n }, (_, i) => i);
  const size = new Array<number>(n).fill(1);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (const [u, v] of edges) {
    let a = find(u);
    let b = find(v);
    if (a === b) continue;
    if (size[a] < size[b]) [a, b] = [b, a];
    parent[b] = a;
    size[a] += size[b];
  }
  return find(source) === find(destination);
}
