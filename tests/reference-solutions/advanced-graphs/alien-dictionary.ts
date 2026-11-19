export function solve(words: string[]): string {
  const next = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  for (const word of words) {
    for (const ch of word) {
      if (!next.has(ch)) {
        next.set(ch, new Set());
        inDegree.set(ch, 0);
      }
    }
  }
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i];
    const b = words[i + 1];
    const len = Math.min(a.length, b.length);
    let j = 0;
    while (j < len && a[j] === b[j]) j++;
    if (j === len) {
      if (a.length > b.length) return "";
      continue;
    }
    const edges = next.get(a[j]) as Set<string>;
    if (!edges.has(b[j])) {
      edges.add(b[j]);
      inDegree.set(b[j], (inDegree.get(b[j]) as number) + 1);
    }
  }
  // At most 26 letters, so a sorted array is a fine min-priority queue.
  const ready = [...inDegree.keys()].filter((ch) => inDegree.get(ch) === 0).sort();
  let order = "";
  while (ready.length > 0) {
    const ch = ready.shift() as string;
    order += ch;
    for (const to of next.get(ch) as Set<string>) {
      const d = (inDegree.get(to) as number) - 1;
      inDegree.set(to, d);
      if (d === 0) {
        ready.push(to);
        ready.sort();
      }
    }
  }
  return order.length === inDegree.size ? order : "";
}
