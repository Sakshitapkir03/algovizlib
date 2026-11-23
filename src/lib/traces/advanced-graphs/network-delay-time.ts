import { z } from "zod";

import { RecordedHeap } from "../heap/shared";
import type { Trace, TraceDefinition, TraceMap, TraceStep } from "../types";
import { layers, MAX_NETWORK_NODES, Network } from "./shared";

/**
 * Dijkstra with a min-heap of (time, server) and a table of best-known arrival times. Pop the earliest entry: if
 * its server is already settled the entry is stale (a slower route pushed before a faster one was found), so skip
 * it; otherwise settle the server, then relax each outgoing link: push the neighbor only when `time + w` beats its
 * best-known time. The answer is the last settled time, or -1 if some server is never settled. A relaxation that
 * improves is good news whatever the sign (`<`: positive); one that doesn't is neutral, as is a stale entry. Key
 * steps: the first settle, the first improvement over a known time, the first stale entry, the first relaxation that
 * doesn't improve, and the end.
 */
export function networkDelayTime(times: number[][], n: number, k: number): Trace {
  const label = (id: number) => String(id + 1);
  const links = times.map(([u, v, w]) => [u - 1, v - 1, w] as [number, number, number]);
  const spots = layers(
    n,
    links.map(([u, v]) => [u, v]),
    [k - 1],
  );
  const net = new Network(spots.map((s, i) => ({ label: label(i), ...s })));
  for (const [u, v, w] of links) net.addEdge(u, v, w);
  const given = net.given();
  const best: (number | null)[] = new Array(n).fill(null);
  const settled = new Array<boolean>(n).fill(false);
  const heap = new RecordedHeap("min");
  // Heap items carry a label; remember which server each one stands for.
  const serverOf = new Map<string, number>();
  const item = (time: number, id: number) => {
    const entry = { key: time, label: `(${time},${label(id)})` };
    serverOf.set(entry.label, id);
    return entry;
  };
  const show = (t: number | null) => (t === null ? "∞" : String(t));
  const table = (updated?: { id: number; from: number | null }): TraceMap => ({
    kind: "map",
    display: "cells",
    entries: best.map((t, id) => ({ key: label(id), value: show(t) })),
    ...(updated ? { updated: { key: label(updated.id), from: show(updated.from) } } : {}),
  });
  const steps: TraceStep[] = [];
  const seen = new Set<string>();
  const first = (kind: string) => (seen.has(kind) ? false : (seen.add(kind), true));

  best[k - 1] = 0;
  heap.push(item(0, k - 1));
  net.setState(k - 1, "ready");
  steps.push({
    kind: "start",
    key: false,
    pointers: {},
    note: `Server ${k} has the message at time 0; every other server's best time is ∞ for now.`,
    network: net.snapshot(),
    heaps: [heap.snapshot()],
    map: table(),
  });
  let count = 0;
  let latest = 0;
  let endNoted = false;
  while (heap.size > 0) {
    const top = heap.pop()!;
    const id = serverOf.get(top.label)!;
    const time = top.key;
    if (settled[id]) {
      steps.push({
        kind: "stale",
        key: first("stale"),
        pointers: {},
        note: `Pop (${time}, ${label(id)}): server ${label(id)} was already settled at ${best[id]}, so this slower entry is stale; skip it.`,
        equation: {
          terms: [time],
          operator: "+",
          result: time,
          comparison: { op: ">", target: best[id]! },
          tone: "neutral",
        },
        network: net.snapshot(),
        heaps: [heap.snapshot()],
        map: table(),
      });
      continue;
    }
    settled[id] = true;
    count++;
    latest = time;
    for (let i = 0; i < n; i++) if (net.state(i) === "current") net.setState(i, "done");
    net.setState(id, "current");
    const done = heap.size === 0 && net.out(id).length === 0;
    endNoted = done;
    steps.push({
      kind: "settle",
      key: first("settle") || done,
      pointers: {},
      note: `Pop (${time}, ${label(id)}): the earliest entry, so server ${label(id)} gets the message at ${time} for good; no other route can be faster, since every link adds time.${done ? ` The heap is empty: ${count === n ? `the last server hears it at ${latest}` : "some servers never hear it"}.` : ""}`,
      network: net.snapshot(),
      heaps: [heap.snapshot()],
      map: table(),
    });
    for (const edge of net.out(id)) {
      const v = edge.to;
      const via = time + edge.weight!;
      const was = best[v];
      const better = was === null || via < was;
      edge.state = better ? "better" : "worse";
      if (better) {
        best[v] = via;
        heap.push(item(via, v));
        net.setState(v, "ready");
      }
      const last = heap.size === 0;
      steps.push({
        kind: better ? "relax" : "no-better",
        key: (was !== null && better ? first("improve") : !better ? first("no-better") : false) || last,
        pointers: {},
        note:
          was === null
            ? `Link ${label(id)} → ${label(v)}: ${time} + ${edge.weight} = ${via}, server ${label(v)}'s first known time; push (${via}, ${label(v)}).`
            : better
              ? `Link ${label(id)} → ${label(v)}: ${time} + ${edge.weight} = ${via}, sooner than ${was}; update server ${label(v)} and push (${via}, ${label(v)}).`
              : `Link ${label(id)} → ${label(v)}: ${time} + ${edge.weight} = ${via}, not sooner than ${was}; nothing changes.`,
        equation: {
          terms: [time, edge.weight!],
          operator: "+",
          result: via,
          ...(was !== null
            ? { comparison: { op: via < was ? "<" : via > was ? ">" : "=", target: was } }
            : {}),
          tone: better ? "positive" : "neutral",
        },
        network: net.snapshot(),
        heaps: [heap.snapshot()],
        map: table(better ? { id: v, from: was } : undefined),
      });
    }
  }
  const answer = count === n ? latest : -1;
  const end = steps.at(-1)!;
  end.key = true;
  // The run ended on a stale pop or a relaxation: say so there.
  if (!endNoted)
    end.note += ` The heap is empty: ${answer === -1 ? "some servers never hear it" : `the last server hears it at ${answer}`}.`;
  return {
    problem: "advanced-graphs/network-delay-time",
    row: { values: [], display: "network" },
    network: given,
    pointerNames: [],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const networkDelayTimeTrace: TraceDefinition<[number[][], number, number]> = {
  problem: "advanced-graphs/network-delay-time",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z
    .tuple([
      z
        .array(z.tuple([z.number().int().min(1), z.number().int().min(1), z.number().int().min(0).max(99)]))
        .max(8),
      z.number().int().min(1).max(MAX_NETWORK_NODES),
      z.number().int().min(1),
    ])
    .refine(
      ([times, n, k]) => k <= n && times.every(([u, v]) => u <= n && v <= n && u !== v),
      "servers are 1…n",
    ),
  run: networkDelayTime,
};
