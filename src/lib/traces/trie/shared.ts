import type { TraceTrie, TraceTrieNode } from "../types";

/** A trie the traces build and walk exactly like the reference solutions, snapshotting it for each step. */
export class RecordedTrie {
  readonly nodes: TraceTrieNode[] = [{ id: 0, parent: null, letter: "", end: false }];
  private nextId = 1;

  child(id: number, letter: string): number | undefined {
    return this.nodes.find((n) => n.parent === id && n.letter === letter)?.id;
  }

  children(id: number): TraceTrieNode[] {
    return this.nodes.filter((n) => n.parent === id);
  }

  node(id: number): TraceTrieNode {
    return this.nodes.find((n) => n.id === id)!;
  }

  /** Insert a word; returns its path (root first) and the nodes it created. */
  insert(word: string, note?: string): { path: number[]; created: number[] } {
    let id = 0;
    const path = [0];
    const created: number[] = [];
    for (const ch of word) {
      let next = this.child(id, ch);
      if (next === undefined) {
        next = this.nextId++;
        this.nodes.push({ id: next, parent: id, letter: ch, end: false });
        created.push(next);
      }
      id = next;
      path.push(id);
    }
    const end = this.node(id);
    end.end = true;
    if (note !== undefined) end.note = note;
    return { path, created };
  }

  /** Remove a node (a leaf); returns it as it was. */
  remove(id: number): TraceTrieNode {
    const k = this.nodes.findIndex((n) => n.id === id);
    const [node] = this.nodes.splice(k, 1);
    return node;
  }

  /** The word spelled from the root to `id`. */
  spell(id: number): string {
    let out = "";
    for (let n: TraceTrieNode | undefined = this.node(id); n && n.parent !== null; n = this.node(n.parent))
      out = n.letter + out;
    return out;
  }

  snapshot(walk: Omit<TraceTrie, "nodes">): TraceTrie {
    return { nodes: this.nodes.map((n) => ({ ...n })), ...walk };
  }
}
