import { z } from "zod";

import { RecordedMap } from "../arrays-hashing/shared";
import type { Trace, TraceDefinition, TraceStep } from "../types";
import { Calls, DoublyList, listValues, opStep } from "./shared";

/** Buckets go in lanes by use count (count 1 in lane 0), so counts stop at 4. */
const MAX_COUNT = 4;

/**
 * A map from key to (value, use count), and one doubly linked list per use count (a bucket, oldest first: a small LRU
 * list), plus the smallest count in use. Using a key unlinks its node from bucket c and appends it to bucket c + 1; if
 * bucket c was the minimum and is now empty, the minimum goes up by one. A new key into a full cache first evicts the
 * oldest node of the minimum bucket, then goes into bucket 1, and the minimum resets to 1. The map shows "70 ×1"
 * (value, uses); a bucket's nodes show their keys; the counter is the minimum count. An eviction is its own step
 * (the node marked rejected) before the insert. Key steps: the first use that moves a key up, the first eviction and
 * the insert after it, the first time the minimum goes up, the first eviction from a bucket above 1, and the last call.
 */
export function lfuCache(operations: string[], args: number[][]): Trace {
  const calls = new Calls(operations, args);
  let capacity = 0;
  let list = new DoublyList();
  let map = new RecordedMap("map", "rows");
  const entries = new Map<number, { value: number; count: number; id: number }>();
  let minCount = 0;
  let lastMin = 0;
  const steps: TraceStep[] = [];
  const shown = new Set<string>();
  const first = (what: string) => (shown.has(what) ? false : (shown.add(what), true));
  const record = (step: Omit<TraceStep, "pointers" | "op" | "links" | "map" | "values" | "counter">) => {
    const links = list.snapshot();
    const counter =
      capacity > 0 && entries.size > 0
        ? { value: minCount, ...(minCount !== lastMin && lastMin > 0 ? { delta: minCount - lastMin } : {}) }
        : undefined;
    if (counter) lastMin = minCount;
    steps.push({
      ...opStep(calls, step),
      map: map.snapshot(),
      ...(links.nodes.length ? { links, values: listValues(links) } : {}),
      ...(counter ? { counter } : {}),
    });
  };
  const show = (e: { value: number; count: number }) => `${e.value} ×${e.count}`;
  const lane = (count: number) => {
    if (count > MAX_COUNT) throw new Error(`use count ${count} doesn't fit: at most ${MAX_COUNT}`);
    return count - 1;
  };

  // A use: move the key's node up one bucket, raising the minimum if its old bucket was the minimum and is now empty.
  const touch = (key: number) => {
    const e = entries.get(key)!;
    const from = e.count;
    list.unlink(e.id);
    const emptied = list.head(lane(from)) === null;
    if (emptied && minCount === from) minCount++;
    e.count++;
    list.pushBack(e.id, lane(e.count));
    map.set(key, show(e));
    return { from, emptied: emptied && minCount === from + 1 };
  };

  operations.forEach((op, k) => {
    calls.run(k);
    const last = k === operations.length - 1;
    if (op === "LFUCache") {
      capacity = args[k][0];
      list = new DoublyList();
      map = new RecordedMap("map", "rows");
      entries.clear();
      minCount = 0;
      lastMin = 0;
      calls.returns(null);
      record({
        kind: "create",
        key: false,
        note: `A new cache that holds ${capacity}: no keys, no buckets.`,
      });
      return;
    }
    const key = args[k][0];
    if (op === "get") {
      if (!map.has(key)) {
        calls.returns(-1);
        record({
          kind: "miss",
          key: last,
          note: `get(${key}): the map has no key ${key}, so the answer is -1.`,
        });
        return;
      }
      const e = entries.get(key)!;
      const { from, emptied } = touch(key);
      calls.returns(e.value);
      record({
        kind: emptied ? "use-min-up" : "use",
        key: last || first("use") || (emptied && first("min-up")),
        note: `get(${key}) = ${e.value}: its node moves from bucket ×${from} to the back of ×${e.count}.${
          emptied
            ? ` Bucket ×${from} is now empty and was the fewest uses, so the minimum becomes ${minCount}.`
            : ""
        }`,
        active: [e.id],
      });
      return;
    }
    const value = args[k][1];
    if (capacity === 0) {
      calls.returns(null);
      record({
        kind: "no-room",
        key: last,
        note: `put(${key}, ${value}): a cache of capacity 0 stores nothing.`,
      });
      return;
    }
    if (map.has(key)) {
      const e = entries.get(key)!;
      e.value = value;
      const { from, emptied } = touch(key);
      calls.returns(null);
      record({
        kind: emptied ? "update-min-up" : "update",
        key: last || first("update"),
        note: `put(${key}, ${value}): key ${key} is cached; its value changes and it moves from bucket ×${from} to ×${e.count}.`,
        active: [e.id],
      });
      return;
    }
    let evicted = false;
    if (entries.size === capacity) {
      const victim = list.head(lane(minCount))!;
      const victimKey = [...entries].find(([, e]) => e.id === victim)![0];
      record({
        kind: "evict",
        key: last || first("evict") || (minCount > 1 && first("evict-above-1")),
        note: `put(${key}, ${value}): the cache is full. The fewest uses is ${minCount}; bucket ×${minCount}'s oldest key, ${victimKey}, is evicted.`,
        rejected: [victim],
      });
      list.remove(victim);
      map.delete(victimKey);
      entries.delete(victimKey);
      evicted = true;
    }
    const id = list.create(String(key));
    entries.set(key, { value, count: 1, id });
    list.pushBack(id, lane(1));
    map.set(key, show({ value, count: 1 }));
    minCount = 1;
    calls.returns(null);
    record({
      kind: "insert",
      key: last || (evicted && first("insert-after-evict")),
      note: evicted
        ? `Key ${key} goes in the map with 1 use and at the back of bucket ×1; the fewest uses is 1 again.`
        : `put(${key}, ${value}): a new key with 1 use, at the back of bucket ×1.`,
      active: [id],
    });
  });

  return {
    problem: "design/lfu-cache",
    row: { values: [], display: "cards" },
    pointerNames: [],
    ops: calls.ops(),
    steps,
    answer: calls.answer(),
    answerDisplay: calls.answerDisplay(),
  };
}

const lfuArgs = z.tuple([
  z
    .array(z.enum(["LFUCache", "get", "put"]))
    .min(2)
    .max(12),
  z.array(z.array(z.number().int().min(0).max(999)).max(2)),
]);

export const lfuCacheTrace: TraceDefinition<[string[], number[][]]> = {
  problem: "design/lfu-cache",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: lfuArgs
    .refine(
      ([ops, args]) => ops[0] === "LFUCache" && args[0][0] <= 3 && !ops.slice(1).includes("LFUCache"),
      "one cache of capacity 0–3, made first",
    )
    .refine(([ops, args]) => ops.every((o, i) => o !== "put" || args[i][0] <= 99), "keys ≤ 99")
    .refine(([ops, args]) => {
      try {
        lfuCache(ops, args);
        return true;
      } catch {
        return false;
      }
    }, `no key used more than ${MAX_COUNT} times`),
  run: lfuCache,
};
