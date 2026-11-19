interface TrieNode {
  children: Map<string, TrieNode>;
  end: boolean;
}

/** Insert every word into a trie, then follow the unbranching path from the root. */
export function solve(words: string[]): string {
  const root: TrieNode = { children: new Map(), end: false };
  for (const word of words) {
    let node = root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = { children: new Map(), end: false };
        node.children.set(ch, next);
      }
      node = next;
    }
    node.end = true;
  }
  let prefix = "";
  let node = root;
  while (!node.end && node.children.size === 1) {
    const [ch, next] = node.children.entries().next().value as [string, TrieNode];
    prefix += ch;
    node = next;
  }
  return prefix;
}
