import { z } from "zod";

import type { Trace, TraceDefinition, TraceQueueItem, TraceStep } from "../types";
import { layers, MAX_NETWORK_NODES, Network } from "./shared";

/**
 * Two phases, like the reference solution. First compare each pair of neighboring words: their first differing
 * letters give one arrow (earlier → later; an arrow already known adds nothing), and a word followed by its own
 * proper prefix makes the list impossible. Then Kahn's algorithm over the letters, always taking the alphabetically
 * smallest ready letter (the ready list is kept sorted; queue items carry the round they were freed in). Letters left
 * over sit on a cycle: no order. Nodes are the letters in alphabetical order, at spots computed from the finished
 * graph so nothing moves. Key steps: comparisons that add an arrow (or end the list), the start of the ordering,
 * every take that frees a letter, and the end.
 */
export function alienDictionary(words: string[]): Trace {
  const letters = [...new Set(words.join(""))].sort();
  const id = (ch: string) => letters.indexOf(ch);
  // The arrows the comparisons will find, so the spots can be computed before the replay.
  const found: [number, number][] = [];
  for (let i = 0; i + 1 < words.length; i++) {
    const [a, b] = [words[i], words[i + 1]];
    let j = 0;
    while (j < Math.min(a.length, b.length) && a[j] === b[j]) j++;
    if (j === Math.min(a.length, b.length)) continue;
    if (!found.some(([f, t]) => f === id(a[j]) && t === id(b[j]))) found.push([id(a[j]), id(b[j])]);
  }
  const inDegree = new Array<number>(letters.length).fill(0);
  for (const [, t] of found) inDegree[t]++;
  const sources = inDegree.flatMap((d, i) => (d === 0 ? [i] : []));
  const spots = layers(letters.length, found, sources.length ? sources : [0]);
  const net = new Network(letters.map((ch, i) => ({ label: ch, ...spots[i] })));
  const given = net.given();
  const steps: TraceStep[] = [];
  const done = (answer: string, extra: Partial<TraceStep> = {}): Trace => ({
    problem: "advanced-graphs/alien-dictionary",
    row: { values: words, display: "cards" },
    network: given,
    pointerNames: [],
    steps: steps.map((s, k) => (k === steps.length - 1 ? { ...s, ...extra, key: true } : s)),
    answer,
    answerDisplay: `"${answer}"`,
  });

  for (let i = 0; i + 1 < words.length; i++) {
    const [a, b] = [words[i], words[i + 1]];
    const len = Math.min(a.length, b.length);
    let j = 0;
    while (j < len && a[j] === b[j]) j++;
    if (j === len) {
      const broken = a.length > b.length;
      steps.push({
        kind: broken ? "prefix" : "no-difference",
        key: broken,
        pointers: {},
        note: broken
          ? `"${b}" is a prefix of "${a}" but comes after it: no alphabet can sort that, so the answer is "".`
          : `"${a}" is a prefix of "${b}", which is fine, but it says nothing about the letters.`,
        ...(broken ? { rejected: [i, i + 1] } : { active: [i, i + 1] }),
        network: net.snapshot(),
      });
      if (broken) return done("");
      continue;
    }
    const [f, t] = [id(a[j]), id(b[j])];
    const known = net.edges.some((e) => e.from === f && e.to === t);
    if (!known) net.addEdge(f, t, undefined, "new");
    steps.push({
      kind: known ? "known" : "arrow",
      key: !known,
      pointers: {},
      note: `"${a}" before "${b}": they first differ at position ${j}, so ${a[j]} comes before ${b[j]}${known ? ", which we already knew" : ""}.`,
      active: [i, i + 1],
      network: net.snapshot(),
    });
  }

  const badge = (i: number) => net.setBadge(i, `in ${inDegree[i]}`);
  letters.forEach((_, i) => badge(i));
  const round = new Array<number>(letters.length).fill(0);
  const ready: TraceQueueItem[] = sources.map((i) => ({ id: i, label: letters[i], level: 0 }));
  for (const i of sources) net.setState(i, "ready");
  let order = "";
  steps.push({
    kind: "start",
    key: true,
    pointers: {},
    note: `Count the arrows into each letter; ${sources.map((i) => letters[i]).join(", ") || "no letter"} ${sources.length === 1 ? "has" : "have"} none, so ${sources.length === 1 ? "it is" : "they are"} ready, kept in alphabetical order.`,
    network: net.snapshot(),
    queue: { items: [...ready], enqueued: [...sources] },
    partial: { items: [], found: [] },
  });
  while (ready.length > 0) {
    const taken = ready.shift()!;
    for (let i = 0; i < letters.length; i++) if (net.state(i) === "current") net.setState(i, "done");
    net.setState(taken.id, "current");
    order += taken.label;
    const freed: number[] = [];
    for (const edge of net.out(taken.id)) {
      edge.state = "used";
      inDegree[edge.to]--;
      badge(edge.to);
      if (inDegree[edge.to] === 0) {
        round[edge.to] = round[taken.id] + 1;
        ready.push({ id: edge.to, label: letters[edge.to], level: round[edge.to] });
        ready.sort((x, y) => x.label.localeCompare(y.label));
        net.setState(edge.to, "ready");
        freed.push(edge.to);
      }
    }
    steps.push({
      kind: "take",
      key: freed.length > 0,
      pointers: {},
      note: `Take ${taken.label}, the smallest ready letter${freed.length ? `; ${freed.map((i) => letters[i]).join(", ")} lose${freed.length > 1 ? "" : "s"} ${freed.length > 1 ? "their" : "its"} last incoming arrow and ${freed.length > 1 ? "are" : "is"} ready` : ""}.`,
      network: net.snapshot(),
      queue: { items: [...ready], dequeued: taken, ...(freed.length ? { enqueued: freed } : {}) },
      partial: { items: [...order], added: taken.label, found: [] },
    });
  }
  for (let i = 0; i < letters.length; i++) if (net.state(i) === "current") net.setState(i, "done");
  const left = inDegree.flatMap((d, i) => (d > 0 ? [i] : []));
  if (left.length === 0) {
    const end = steps.at(-1)!;
    return done(order, { note: `${end.note} Every letter is placed: "${order}".` });
  }
  for (const i of left) net.setState(i, "stuck");
  steps.push({
    kind: "cycle",
    key: true,
    pointers: {},
    note: `Nothing is ready, but ${left.map((i) => letters[i]).join(", ")} still have arrows into them: they sit on a cycle, so the answer is "".`,
    network: net.snapshot(),
    queue: { items: [] },
    partial: { items: [...order], found: [] },
  });
  return done("");
}

export const alienDictionaryTrace: TraceDefinition<[string[]]> = {
  problem: "advanced-graphs/alien-dictionary",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z.tuple([
    z
      .array(z.string().regex(/^[a-z]{1,4}$/))
      .min(2)
      .max(5)
      .refine((w) => new Set(w.join("")).size <= MAX_NETWORK_NODES, "at most 7 distinct letters"),
  ]),
  run: alienDictionary,
};
