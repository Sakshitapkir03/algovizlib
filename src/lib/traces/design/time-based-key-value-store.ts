import { z } from "zod";

import { RecordedMap } from "../arrays-hashing/shared";
import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";
import { Calls, opStep } from "./shared";

/**
 * A map from key to its history, a list of (timestamp, value) pairs. set appends, and because set timestamps only
 * increase the list stays sorted, so get binary-searches it for the last timestamp ≤ the query (or "" when there's
 * none). The map shows a key's history as "2:red 5:blue"; the row is the history's timestamps, and each search step
 * checks one of them (`search` over the row). Sets all use one key and come before every get, so the row is the same
 * in every get scene. Key steps: the second set (the history stays sorted), every get's answer, and the first search
 * whose last check finds a later entry (it and everything after are too late). Tones: a
 * timestamp at or before the query is positive (a candidate), a later one neutral.
 */
export function timeBasedKeyValueStore(operations: string[], args: (string | number)[][]): Trace {
  const calls = new Calls(operations, args);
  let map = new RecordedMap("map", "rows");
  let history = new Map<string, { times: number[]; values: string[] }>();
  const steps: TraceStep[] = [];
  const record = (step: Omit<TraceStep, "pointers" | "op" | "map">) =>
    steps.push({ ...opStep(calls, step), map: map.snapshot() });
  const show = (h: { times: number[]; values: string[] }) =>
    h.times.map((t, i) => `${t}:${h.values[i]}`).join(" ");

  let checkedLater = false;
  operations.forEach((op, k) => {
    calls.run(k);
    if (op === "TimeMap") {
      map = new RecordedMap("map", "rows");
      history = new Map();
      calls.returns(null);
      record({ kind: "create", key: false, note: "A new store: no keys yet." });
      return;
    }
    if (op === "set") {
      const [key, value, time] = args[k] as [string, string, number];
      const h = history.get(key) ?? { times: [], values: [] };
      history.set(key, h);
      h.times.push(time);
      h.values.push(value);
      map.set(key, show(h));
      calls.returns(null);
      record({
        kind: "set",
        // The first append that shows the history staying sorted.
        key:
          h.times.length === 2 ||
          (h.times.length === 1 && operations.filter((o) => o === "set").length === 1),
        note:
          h.times.length === 1
            ? `set("${key}", "${value}", ${time}): a new key, its history starts with (${time}, ${value}).`
            : `set("${key}", "${value}", ${time}): append (${time}, ${value}); timestamps only grow, so the history stays sorted.`,
      });
      return;
    }
    const [key, time] = args[k] as [string, number];
    const h = map.has(key) ? history.get(key)! : undefined;
    if (!h) {
      calls.returns("");
      record({
        kind: "missing-key",
        key: true,
        note: `get("${key}", ${time}): the map has no key "${key}", so the answer is "".`,
      });
      return;
    }
    // Rightmost timestamp ≤ time, exactly like the reference solution.
    let lo = 0;
    let hi = h.times.length - 1;
    let best = -1;
    const checks: TraceStep[] = [];
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const fits = h.times[mid] <= time;
      checks.push({
        kind: fits ? "check-fits" : "check-later",
        key: false,
        pointers: {},
        note: fits
          ? `get("${key}", ${time}): the middle entry, set at ${h.times[mid]}, is at or before ${time}: a candidate (${h.values[mid]}); look right for a later one.`
          : `get("${key}", ${time}): the middle entry, set at ${h.times[mid]}, is after ${time}: it and everything right of it are too late; look left.`,
        search: { from: lo, to: hi, mid },
        active: [mid],
        ...(best >= 0 ? { found: [best] } : {}),
        equation: {
          terms: [h.times[mid]],
          operator: "+",
          result: h.times[mid],
          comparison: { op: compare(h.times[mid], time), target: time },
          tone: fits ? "positive" : "neutral",
        },
      });
      if (fits) {
        best = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    // The first search whose last check rules out a later entry shows why the answer is the one before it.
    const settle = checks.at(-1)!;
    if (settle.kind === "check-later" && !checkedLater) {
      settle.key = true;
      checkedLater = true;
    }
    for (const check of checks) {
      steps.push({ ...check, op: calls.op(), map: map.snapshot() });
      // Every check reads the same key; the map shows the lookup on each.
      map.has(key);
    }
    const answer = best >= 0 ? h.values[best] : "";
    calls.returns(answer);
    record({
      kind: best >= 0 ? "answer" : "none-before",
      key: true,
      note:
        best >= 0
          ? `Nothing later is at or before ${time}, so get("${key}", ${time}) returns the value set at ${h.times[best]}: "${answer}".`
          : `Every entry was set after ${time}, so get("${key}", ${time}) returns "".`,
      search: { from: lo, to: hi },
      ...(best >= 0 ? { found: [best] } : {}),
    });
  });

  // The row is the history of the one key that's set (its timestamps), what every get searches.
  const [setKey] = operations.flatMap((op, k) => (op === "set" ? [String(args[k][0])] : []));
  const row = setKey ? history.get(setKey)! : { times: [], values: [] };
  return {
    problem: "design/time-based-key-value-store",
    row: { values: row.times, display: "cards" },
    pointerNames: [],
    ops: calls.ops(),
    steps,
    answer: calls.answer(),
    answerDisplay: calls.answerDisplay(),
  };
}

export const timeBasedKeyValueStoreTrace: TraceDefinition<[string[], (string | number)[][]]> = {
  problem: "design/time-based-key-value-store",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z
    .tuple([
      z
        .array(z.enum(["TimeMap", "set", "get"]))
        .min(2)
        .max(10),
      z.array(z.array(z.union([z.string().max(6), z.number().int().min(1).max(99)])).max(3)),
    ])
    .refine(([ops]) => ops[0] === "TimeMap" && !ops.slice(1).includes("TimeMap"), "one store, made first")
    .refine(([ops, args]) => {
      // One key is set, at most 4 times, and every set comes before every get (the row never changes).
      const sets = ops.flatMap((o, i) => (o === "set" ? [i] : []));
      const firstGet = ops.indexOf("get");
      return (
        new Set(sets.map((i) => args[i][0])).size <= 1 &&
        sets.length <= 4 &&
        (firstGet === -1 || sets.every((i) => i < firstGet))
      );
    }, "one key set at most 4 times, before any get"),
  run: timeBasedKeyValueStore,
};
