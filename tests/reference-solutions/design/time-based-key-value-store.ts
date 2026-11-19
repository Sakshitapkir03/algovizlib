class TimeMap {
  private history = new Map<string, { times: number[]; values: string[] }>();

  set(key: string, value: string, timestamp: number): void {
    let entry = this.history.get(key);
    if (!entry) {
      entry = { times: [], values: [] };
      this.history.set(key, entry);
    }
    entry.times.push(timestamp);
    entry.values.push(value);
  }

  get(key: string, timestamp: number): string {
    const entry = this.history.get(key);
    if (!entry) return "";
    // Rightmost index with times[index] <= timestamp.
    let lo = 0;
    let hi = entry.times.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (entry.times[mid] <= timestamp) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found === -1 ? "" : entry.values[found];
  }
}

export function solve(operations: string[], args: (string | number)[][]): (string | null)[] {
  let store = new TimeMap();
  return operations.map((op, i) => {
    const a = args[i];
    switch (op) {
      case "TimeMap":
        store = new TimeMap();
        return null;
      case "set":
        store.set(a[0] as string, a[1] as string, a[2] as number);
        return null;
      case "get":
        return store.get(a[0] as string, a[1] as number);
      default:
        throw new Error(`unknown operation ${op}`);
    }
  });
}
