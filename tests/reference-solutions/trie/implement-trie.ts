interface TrieNode {
  children: Map<string, TrieNode>;
  end: boolean;
}

class Trie {
  private root: TrieNode = { children: new Map(), end: false };

  insert(word: string): void {
    let node = this.root;
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

  search(word: string): boolean {
    return this.walk(word)?.end ?? false;
  }

  startsWith(prefix: string): boolean {
    return this.walk(prefix) !== null;
  }

  private walk(text: string): TrieNode | null {
    let node: TrieNode | undefined = this.root;
    for (const ch of text) {
      node = node.children.get(ch);
      if (!node) return null;
    }
    return node;
  }
}

export function solve(operations: string[], args: string[][]): (boolean | null)[] {
  let trie = new Trie();
  return operations.map((op, i) => {
    switch (op) {
      case "Trie":
        trie = new Trie();
        return null;
      case "insert":
        trie.insert(args[i][0]);
        return null;
      case "search":
        return trie.search(args[i][0]);
      case "startsWith":
        return trie.startsWith(args[i][0]);
      default:
        throw new Error(`unknown operation ${op}`);
    }
  });
}
