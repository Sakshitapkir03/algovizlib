import { z } from "zod";

import { RecordedMap } from "../arrays-hashing/shared";
import type { Trace, TraceDefinition, TraceStep } from "../types";
import { Calls, DoublyList, listValues, opStep } from "./shared";

/**
 * A hash map from key to its node, and a doubly linked list of nodes in recency order (front = most recently used).
 * get looks the key up in the map; a hit unlinks the node and puts it at the front (a few pointer assignments). put on
 * a new key into a full cache first evicts the node at the back, the least recently used, from both the list and the
 * map. Nodes show "key:value". An eviction is its own step (the back node marked rejected) before the insert. Key
 * steps: the put that fills the cache, the first hit (and the first update), the first eviction and the insert after
 * it, the first miss, and the last call.
 */
export function lruCache(operations: string[], args: number[][]): Trace {
  const calls = new Calls(operations, args);
  let capacity = 0;
  let list = new DoublyList();
  let map = new RecordedMap("map", "rows");
  const nodeOf = new Map<number, number>();
  const steps: TraceStep[] = [];
  const shown = new Set<string>();
  const first = (what: string) => (shown.has(what) ? false : (shown.add(what), true));
  const record = (step: Omit<TraceStep, "pointers" | "op" | "links" | "map" | "values">) => {
    const links = list.snapshot();
    steps.push({
      ...opStep(calls, step),
      map: map.snapshot(),
      ...(links.nodes.length ? { links, values: listValues(links) } : {}),
    });
  };
  const label = (key: number, value: number) => `${key}:${value}`;

  operations.forEach((op, k) => {
    calls.run(k);
    const last = k === operations.length - 1;
    if (op === "LRUCache") {
      capacity = args[k][0];
      list = new DoublyList();
      map = new RecordedMap("map", "rows");
      nodeOf.clear();
      calls.returns(null);
      record({
        kind: "create",
        key: false,
        note: `A new cache that holds ${capacity}: the map and the list start empty.`,
      });
      return;
    }
    const key = args[k][0];
    if (op === "get") {
      const found = map.has(key);
      if (!found) {
        calls.returns(-1);
        record({
          kind: "miss",
          key: last || first("miss"),
          note: `get(${key}): the map has no key ${key}, so the answer is -1 and nothing moves.`,
        });
        return;
      }
      const id = nodeOf.get(key)!;
      const value = Number(map.get(key));
      const atFront = list.head(0) === id;
      if (!atFront) {
        list.unlink(id);
        list.pushFront(id, 0);
      }
      calls.returns(value);
      record({
        kind: "hit",
        key: last || (!atFront && first("hit")),
        note: atFront
          ? `get(${key}): the map points straight at its node, already at the front; the answer is ${value}.`
          : `get(${key}): the map points straight at its node; unlink it and put it at the front (it's now the most recent). The answer is ${value}.`,
        active: [id],
      });
      return;
    }
    // put
    const value = args[k][1];
    if (map.has(key)) {
      const id = nodeOf.get(key)!;
      map.set(key, value);
      list.setValue(id, label(key, value));
      if (list.head(0) !== id) {
        list.unlink(id);
        list.pushFront(id, 0);
      }
      calls.returns(null);
      record({
        kind: "update",
        key: last || first("update"),
        note: `put(${key}, ${value}): key ${key} is already cached, so its value changes and its node moves to the front.`,
        active: [id],
      });
      return;
    }
    if (map.size() === capacity) {
      const victim = list.tail(0)!;
      const [victimKey] = String(list.value(victim)).split(":");
      record({
        kind: "evict",
        key: last || first("evict"),
        note: `put(${key}, ${value}): the cache is full, so the node at the back, key ${victimKey}, the least recently used, is evicted.`,
        rejected: [victim],
      });
      list.remove(victim);
      map.delete(victimKey);
      nodeOf.delete(Number(victimKey));
    }
    const evicted = steps.at(-1)?.kind === "evict" && steps.at(-1)!.op!.current === k;
    const id = list.create(label(key, value));
    nodeOf.set(key, id);
    list.pushFront(id, 0);
    map.set(key, value);
    calls.returns(null);
    record({
      kind: "insert",
      key: last || (evicted && first("insert-after-evict")) || (map.size() === capacity && first("full")),
      note: evicted
        ? `With room again, ${key}:${value} goes in the map and at the front of the list.`
        : `put(${key}, ${value}): a new key: the map points at a new node, placed at the front of the list.`,
      active: [id],
    });
  });

  return {
    problem: "design/lru-cache",
    row: { values: [], display: "cards" },
    pointerNames: [],
    ops: calls.ops(),
    steps,
    answer: calls.answer(),
    answerDisplay: calls.answerDisplay(),
  };
}

export const lruCacheTrace: TraceDefinition<[string[], number[][]]> = {
  problem: "design/lru-cache",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z
    .tuple([
      z
        .array(z.enum(["LRUCache", "get", "put"]))
        .min(2)
        .max(11),
      z.array(z.array(z.number().int().min(0).max(999)).max(2)),
    ])
    .refine(
      ([ops, args]) =>
        ops[0] === "LRUCache" && args[0][0] >= 1 && args[0][0] <= 3 && !ops.slice(1).includes("LRUCache"),
      "one cache of capacity 1–3, made first",
    )
    // "key:value" fits in a node box.
    .refine(
      ([ops, args]) => ops.every((o, i) => o !== "put" || (args[i][0] <= 99 && args[i][1] <= 999)),
      "keys ≤ 99",
    ),
  run: lruCache,
};
