interface TrieNode {
  children: Map<string, TrieNode>;
  end: boolean;
}

class WordDictionary {
  private root: TrieNode = { children: new Map(), end: false };

  addWord(word: string): void {
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

  search(pattern: string): boolean {
    const match = (node: TrieNode, i: number): boolean => {
      if (i === pattern.length) return node.end;
      const ch = pattern[i];
      if (ch === ".") {
        for (const child of node.children.values()) if (match(child, i + 1)) return true;
        return false;
      }
      const child = node.children.get(ch);
      return child ? match(child, i + 1) : false;
    };
    return match(this.root, 0);
  }
}

export function solve(operations: string[], args: string[][]): (boolean | null)[] {
  let dictionary = new WordDictionary();
  return operations.map((op, i) => {
    switch (op) {
      case "WordDictionary":
        dictionary = new WordDictionary();
        return null;
      case "addWord":
        dictionary.addWord(args[i][0]);
        return null;
      case "search":
        return dictionary.search(args[i][0]);
      default:
        throw new Error(`unknown operation ${op}`);
    }
  });
}
