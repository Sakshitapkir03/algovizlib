interface Node {
  key: number;
  value: number;
  prev: Node | null;
  next: Node | null;
}

class LRUCache {
  private nodes = new Map<number, Node>();
  private head: Node = { key: -1, value: -1, prev: null, next: null };
  private tail: Node = { key: -1, value: -1, prev: null, next: null };

  constructor(private capacity: number) {
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: number): number {
    const node = this.nodes.get(key);
    if (!node) return -1;
    this.unlink(node);
    this.pushFront(node);
    return node.value;
  }

  put(key: number, value: number): void {
    const existing = this.nodes.get(key);
    if (existing) {
      existing.value = value;
      this.unlink(existing);
      this.pushFront(existing);
      return;
    }
    if (this.nodes.size === this.capacity) {
      const lru = this.tail.prev as Node;
      this.unlink(lru);
      this.nodes.delete(lru.key);
    }
    const node: Node = { key, value, prev: null, next: null };
    this.nodes.set(key, node);
    this.pushFront(node);
  }

  private unlink(node: Node): void {
    (node.prev as Node).next = node.next;
    (node.next as Node).prev = node.prev;
  }

  private pushFront(node: Node): void {
    node.prev = this.head;
    node.next = this.head.next;
    (this.head.next as Node).prev = node;
    this.head.next = node;
  }
}

export function solve(operations: string[], args: number[][]): (number | null)[] {
  let cache = new LRUCache(0);
  return operations.map((op, i) => {
    switch (op) {
      case "LRUCache":
        cache = new LRUCache(args[i][0]);
        return null;
      case "get":
        return cache.get(args[i][0]);
      case "put":
        cache.put(args[i][0], args[i][1]);
        return null;
      default:
        throw new Error(`unknown operation ${op}`);
    }
  });
}
