class LFUCache {
  private entries = new Map<number, { value: number; count: number }>();
  /** count → keys with that count, in recency order (a Set keeps insertion order). */
  private buckets = new Map<number, Set<number>>();
  private minCount = 0;

  constructor(private capacity: number) {}

  get(key: number): number {
    const entry = this.entries.get(key);
    if (!entry) return -1;
    this.touch(key, entry);
    return entry.value;
  }

  put(key: number, value: number): void {
    if (this.capacity === 0) return;
    const entry = this.entries.get(key);
    if (entry) {
      entry.value = value;
      this.touch(key, entry);
      return;
    }
    if (this.entries.size === this.capacity) {
      const bucket = this.buckets.get(this.minCount) as Set<number>;
      const victim = bucket.values().next().value as number;
      bucket.delete(victim);
      if (bucket.size === 0) this.buckets.delete(this.minCount);
      this.entries.delete(victim);
    }
    this.entries.set(key, { value, count: 1 });
    this.bucket(1).add(key);
    this.minCount = 1;
  }

  private touch(key: number, entry: { value: number; count: number }): void {
    const old = this.buckets.get(entry.count) as Set<number>;
    old.delete(key);
    if (old.size === 0) {
      this.buckets.delete(entry.count);
      if (this.minCount === entry.count) this.minCount++;
    }
    entry.count++;
    this.bucket(entry.count).add(key);
  }

  private bucket(count: number): Set<number> {
    let set = this.buckets.get(count);
    if (!set) {
      set = new Set();
      this.buckets.set(count, set);
    }
    return set;
  }
}

export function solve(operations: string[], args: number[][]): (number | null)[] {
  let cache = new LFUCache(0);
  return operations.map((op, i) => {
    switch (op) {
      case "LFUCache":
        cache = new LFUCache(args[i][0]);
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
