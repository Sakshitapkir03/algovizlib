interface TrieNode {
  children: Map<string, TrieNode>;
  end: boolean;
}

/** Roots in a trie; each word walks it and stops at the first root end (the shortest matching root). */
export function solve(roots: string[], sentence: string): string {
  const root: TrieNode = { children: new Map(), end: false };
  for (const word of roots) {
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
  const shorten = (word: string): string => {
    let node = root;
    for (let i = 0; i < word.length; i++) {
      const next = node.children.get(word[i]);
      if (!next) return word;
      if (next.end) return word.slice(0, i + 1);
      node = next;
    }
    return word;
  };
  return sentence.split(" ").map(shorten).join(" ");
}
