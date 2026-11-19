export function solve(words: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const word of words) {
    const counts = new Array<number>(26).fill(0);
    for (let i = 0; i < word.length; i++) counts[word.charCodeAt(i) - 97]++;
    const label = counts.join(",");
    const group = groups.get(label);
    if (group) group.push(word);
    else groups.set(label, [word]);
  }
  return [...groups.values()];
}
